# Policy Serving & Deployment Contract

!!! abstract "Purpose / Audience"
    the official contract between the SODA dual-arm platform and
    policy providers (you). It specifies exactly how a policy is served, what the robot
    sends, what your policy must return, and how timing works — everything you need to
    train and host your own policy for this robot. Every number reflects the platform as
    currently deployed. Day-to-day operation: [running-your-policy.md](running-your-policy.md);
    the code-grounded wire appendix ships with the unit
    (integration docs).


---

## 1. Architecture

Your policy runs as a **standalone inference server on your machine**; the robot
connects to it as a client over the network.

```
┌────────────────────┐   observation (15 Hz-class)   ┌──────────────────────┐
│  ROBOT (client)    │ ────────────────────────────► │  YOUR POLICY SERVER  │
│  cameras · arms ·  │                               │  any framework, any  │
│  safety layer      │ ◄──────────────────────────── │  GPU, WebSocket      │
└────────────────────┘     action chunk (T × W)      └──────────────────────┘
```

- You may host **(a)** an OpenPI-format checkpoint (runnable with the standard OpenPI
`serve_policy` server, which speaks this protocol natively), or **(b)** any custom
server that implements the wire protocol in §2.
- **Conformance is the policy provider's responsibility.** This document is the primary
and complete reference: train your policy, shape your data, and build your server
according to this contract. The platform does not adapt checkpoints or reshape
interfaces on your behalf.
- The robot side (drivers, cameras, safety clamps, timing) is fixed platform
infrastructure — your policy never needs to know about motors, only about the
observation → action-chunk mapping defined here.

---

## 2. Wire protocol

- **Transport**: WebSocket, `ws://<your-host>:<port>` (host/port registered in the
robot's policy config, §6). Compression disabled, no frame-size cap.
- **Encoding**: msgpack with the OpenPI numpy extension — each array is packed as a map:
  ```python
  {b"__ndarray__": True, b"data": <raw bytes>, b"dtype": <dtype.str>, b"shape": <shape>}
  ```
  identical to the official `openpi_client` protocol, so OpenPI's
  `websocket_policy_server` works unmodified. (Wrapper keys are **bytes**; the
  top-level request keys `"state"` / `"images"` / `"prompt"` are **str**.)
- **Handshake**: on every new connection — including reconnects after a dropped
socket — your server **must send exactly one msgpack metadata map before reading
anything**. An empty `{}` is accepted; optional keys `action_space` /
`orient_rep` assist action-space auto-detection. A server that skips this frame
deadlocks the client. (OpenPI's server does this natively; only custom servers
need to care.)
- **Pattern**: after the handshake, strict request→response. One observation in, one
action chunk out. To signal an error, send a **text** frame — the robot raises it
as a policy-server error.

### Request (robot → server), one msgpack map


| key      | type / shape                                | content                                                                                   |
| -------- | ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `state`  | float32 `(14,)`                             | joint state, layout in §3.2                                                               |
| `images` | map of 3 arrays, each uint8 `(3, 224, 224)` | keys `cam_high`, `cam_left_wrist`, `cam_right_wrist`; RGB, channel-first; framing in §3.1 |
| `prompt` | str                                         | the task instruction, verbatim                                                            |


### Response (server → robot), one msgpack map


| key       | type / shape     | content                                                                                                                                                                     |
| --------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `actions` | float32 `(T, W)` | action chunk; `T` = your chunk length (50 typical); `W` = action width, which selects the **action space** (§4.1). All values must be finite — a NaN/Inf chunk is rejected. |


Accepted widths `W`: **14** (joint position — the reference space), **16/20**
(cartesian pose, quat/rot6d), **38** (joint impedance), **40** (cartesian impedance).
All four are fully specified in §4.1.

---

## 3. Observation specification

### 3.1 Images

Three RGB cameras: **left wrist**, **right wrist**, and a fixed **side/overview**
camera (`cam_high`). Native capture 1280×720 at **15 fps**. Before transmission the
robot applies, per frame:

1. BGR→RGB conversion,
2. **aspect-preserving resize + black letterbox to 224×224** (identical to OpenPI's
  `resize_with_pad`; the 16:9 content occupies a 224×126 band with black bars).

So your policy always receives 224×224×3 RGB uint8 (sent channel-first). **Train on
identically-framed images.** If your training pipeline uses OpenPI's standard
`resize_with_pad`, you match automatically; if you crop or stretch instead, your
policy will see different geometry at deployment than in training.

In async mode (§5) each inference receives the **newest available frame** — the
camera stream rate bounds freshness (≤ ~67 ms age), not the inference rate.

### 3.2 State (`state`, float32 14-D, and the action layout too)


| index   | 0–5                 | 6            | 7–12                 | 13            |
| ------- | ------------------- | ------------ | -------------------- | ------------- |
| meaning | LEFT arm joints 1–6 | LEFT gripper | RIGHT arm joints 1–6 | RIGHT gripper |


- Arm joints: **absolute positions, radians** (measured, not commanded).
- Grippers: expressed in **your declared policy convention** — before sending, the
robot maps the measured hardware gripper (0.0 open → 0.67 closed) back into your
`gripper_source_`* range (§6), so `state` and `actions` always share one
convention. With the template's identity mapping (source = 0→0.67) the state is
the hardware range itself; a policy trained on, e.g., a 0→1.52 convention
receives 0→1.52. If these fields are omitted, the platform default source
convention is 0.0 (open) → 1.52 (closed).

### 3.3 Prompt

A plain natural-language instruction string, passed to your server verbatim from the
deployment config. Byte-exact match with your training prompts is your responsibility
(including case and punctuation).

---

## 4. Action specification

- Row spacing in time is **1 / control_hz** (§5): the robot executes one row per
control tick and linearly interpolates between rows at 250 Hz.
- Chunk length `T` is yours to choose; the platform standard is **50**.
- Grippers are always expressed in your declared policy space and linearly mapped to
hardware 0–0.67 by the robot (§6).

### 4.1 Action spaces (selected by chunk width `W`)

The robot-side executor accepts several action spaces; every one is converted to the
same 14-D joint pipeline before execution. Per-arm blocks are ordered LEFT then RIGHT
in all spaces. Quaternions are **[w, x, y, z]**.


| `W`    | space                   | per-arm layout (×2 arms)                                | robot-side handling                                                                                                                               |
| ------ | ----------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **14** | `joint_pos` (reference) | `[q1..q6 (rad, absolute), grip]` = 7                    | executed directly through the joint pipeline (ensemble → filters → clamps)                                                                        |
| **16** | `cart_pos`, quat        | `[pos xyz (m), quat wxyz, grip]` = 8                    | end-effector (link_6) pose **in that arm's own base frame** → analytic IK, warm-started per step; on IK failure the arm holds its previous joints |
| **20** | `cart_pos`, rot6d       | `[pos xyz, rot6d, grip]` = 10                           | same as above with 6-D rotation representation                                                                                                    |
| **38** | `joint_impedance`       | `[q1..q6, grip, kp1..kp6, kd1..kd6]` = 19               | joint targets executed as in `joint_pos`; the chunk's kp/kd additionally command per-joint stiffness/damping gains                                |
| **40** | `cart_impedance`        | `[pos xyz, quat wxyz, K_cart(6), D_cart(6), grip]` = 20 | pose is IK'd to joints (stable path); for a pure pose policy prefer `cart_pos` — this space exists for gain-commanding policies                   |


Why several spaces exist: the executor separates *what the policy predicts* from *how
the arm is driven*. Joint-space is the reference — it is what the platform's own
policies are trained with (absolute joint positions imitate teleop demonstrations
directly, with no IK in the loop) and the most-tested path. Cartesian spaces let you
train in end-effector coordinates and let the robot's analytic IK produce joints.
Impedance variants additionally let the policy modulate compliance over time.

Selection: the deployment entry's `action_space` field (§6) may name the space
explicitly, or be `auto` — the robot then infers the space from `W` on a probe chunk.
Width 14 is ambiguous in principle (it is assumed `joint_pos`, the common case), and
every deployment shows a **dry-run interpretation preview** of how the chunk will be
read before going live — confirm it matches your intent.

### 4.2 Reference space details (`W = 14`)

Each row: **absolute joint-position targets in radians**, exactly the state layout of
§3.2. This is the space this contract's worked examples and the platform's training
pipeline (§7) assume.

### Robot-side safety layer (applied to your actions, non-negotiable)


| mechanism                       | default                      | effect                                                                                                 |
| ------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| per-tick joint clamp            | 0.05 rad/tick (configurable) | bounds per-tick joint motion                                                                           |
| absolute joint-velocity ceiling | 2.5 rad/s                    | hard cap independent of `control_hz` — raising `control_hz` cannot loosen the effective per-tick limit |
| per-tick gripper clamp          | 0.5 /tick (ceiling 25 /s)    | bounds gripper slew                                                                                    |
| outlier rejection               | 0.5 rad                      | discards chunk values that jump implausibly vs. the blended stream                                     |
| temporal ensembling             | decay 0.1                    | overlapping chunks from successive inferences are blended (async mode)                                 |
| One-Euro smoothing              | mincutoff 1.5, β 0.2         | final command smoothing                                                                                |
| gripper binarization            | on (configurable)            | snaps gripper to open/closed                                                                           |


Design your policy to output smooth, physically plausible trajectories; the safety
layer is a backstop, not a co-processor. A policy that fights the clamps will feel
sluggish and is out of contract.

---

## 5. Timing contract

Ideal (contractual) values first; real-world deviations are footnoted.


| rate           | value                                                                                                                                                  | role                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `control_hz`   | **set it to your dataset rate** (per-policy, §6). Left unset, the platform falls back to **50** — never leave it unset for a 15 fps-built dataset (§8) | the ONLY rate your policy must care about: one action row consumed per tick  |
| command stream | 250 Hz                                                                                                                                                 | robot-internal linear interpolation between your action rows                 |
| motor control  | 500 Hz                                                                                                                                                 | robot-internal MIT-mode torque loop                                          |
| cameras        | 15 fps                                                                                                                                                 | observation freshness bound                                                  |
| inference      | asynchronous, continuous                                                                                                                               | a worker infers as fast as your server responds; chunks are ensemble-blended |


- **Async inference is the platform mode.** Your server should sustain roughly one
inference per 0.1–0.5 s. With chunk 50 at 15 Hz (3.3 s of future per chunk), even
0.5 s latency leaves a deep action buffer; at latency > ~1 s the blending degrades
and motion becomes seam-y.
- Your chunk should cover **several seconds** of motion: `T / control_hz` well above
your worst-case inference latency. `T = 50` at 14–15 Hz gives ~3.3–3.6 s. ✔
- Footnote on real rates: nominal rates carry a small real-world shortfall (loop
scheduling, transport): e.g. a 15 fps camera stream measures ~14.7 fps; a 150 Hz
internal loop measures ~142 Hz. Design to the nominal values; the shortfall is
≤ ~5% and does not change any contract semantics.

---

## 6. Deployment configuration

Each policy is registered on the robot as **one YAML file** in the policy registry —
on the robot host, `/opt/robot/policies/policies/<id>.yaml` (the UI's **Add policy**
dialog writes these for you; the registry re-reads disk on every request, so no
restart is needed). Annotated template:

```yaml
# /opt/robot/policies/policies/your_policy_name.yaml
id: your_policy_name
type: openpi_ws              # WebSocket policy, protocol of §2
host: <your-server-ip>
port: <your-port>
prompts:                     # instructions selectable at run time — byte-exact
  - put the red cube into the bowl
action_space: auto           # or explicit: joint_pos | cart_pos | joint_impedance | cart_impedance (§4.1)
orient_rep: quat             # for cartesian spaces: quat (W=16/40) or rot6d (W=20)
image_mode: pad169           # letterbox framing of §3.1 (the standard; do not change
                             # unless your training framing differs)
gripper_source_open: 0.0     # YOUR policy's gripper convention...
gripper_source_close: 0.67   # ...mapped linearly to hardware 0 -> 0.67
gripper_target_open: 0.0     # (omit source/target fields to take the platform
gripper_target_close: 0.67   #  defaults: source 0 -> 1.52, target from site.yaml)
info:
  chunk_h: 50                # your chunk length
  control_hz: 15             # MUST match your dataset rate (see §8)
defaults:
  control_hz: 15
  send_hz: 250
  infer_mode: async
  ensemble_decay: 0.1
  max_joint_delta: 0.05      # raise (e.g. 0.11) only if your task's demonstrated
                             # per-step deltas exceed it — measure your data
  binarize_gripper: true
```

---

## 7. Training a policy on platform data

Data collected on the platform (teleoperation recordings) has this shape:

- Control/state/action log at **150 Hz** nominal (measured ~142 Hz) — absolute joint
positions, commanded and measured, plus per-step camera-frame pairing.
- Camera videos at the true unique-frame rate, currently **~15 fps**, 1280×720, three
views.
- Per-episode instruction string.

The one rule that connects training to deployment (motivated in §8):

!!! note "Your dataset's declared rate (fps) must equal the `control_hz` you deploy with."
    Build the dataset at ~15 Hz (one sample per camera frame), declare that rate in its
    metadata, set `control_hz` to the same number.


Also: compute your normalization statistics on your own dataset; train on letterboxed
224×224 images (§3.1); keep prompts byte-identical between training data and the
deployed `prompts:` list.

---

## 8. Frequencies vs. robot execution speed — what matters, what does not

This is the part everyone gets wrong once. Read it even if you skip everything else.

### The flipbook

Your policy is a **flipbook artist**: given a photo of the scene, it draws the next
50 pages of arm poses. The robot is the **reader**: it flips one page per control
tick (`1/control_hz` seconds).

A flipbook only plays at the right speed if the *page spacing the artist intended*
equals the *flip speed of the reader*. The artist's intended spacing is set during
**training** — it is your dataset's rate: if your dataset says 15 Hz, every page the
policy draws means "1/15 s after the previous page."

### The one rule

!!! quote
    **Execution speed is set by exactly one pair of numbers: dataset rate ↔︎
    `control_hz`. Nothing else on the platform makes the robot faster or slower.**


- dataset 15 Hz, `control_hz` 15 → the robot moves at demonstration speed. ✔
- dataset 15 Hz, `control_hz` 30 → every motion plays **2× too fast** (surge,
clipping against safety clamps).
- dataset 30 Hz, `control_hz` 15 → everything at **half speed**.

The error is silent — no crash, no warning, just a robot that moves eerily wrong. It
is the single most common integration mistake; check this pair first.

### What the other rates actually do (and don't)


| rate                       | what it REALLY affects                                                                                                | common misconception, debunked                                                                                                                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| camera fps (15)            | freshness of the photo each inference sees (≤67 ms age) — and the ceiling on what dataset rate you can honestly build | "faster cameras make the robot faster" — no; the artist draws from one photo, however often photos arrive                                                                                                            |
| inference latency          | buffer depth / blending quality (§5)                                                                                  | "slow inference makes slow motion" — no; the reader flips pages from the buffer at `control_hz` regardless; latency only risks the buffer running dry                                                                |
| 250 Hz command stream      | smoothness *between* your pages (interpolation)                                                                       | "15 Hz control looks choppy" — no; the robot never moves in 15 Hz steps, it glides through them at 250 Hz                                                                                                            |
| 500 Hz motor loop          | torque-level tracking                                                                                                 | invisible to policies entirely                                                                                                                                                                                       |
| your raw data log (150 Hz) | oversampled telemetry you *cut* the dataset from                                                                      | "we logged at 150 Hz so deploy at 150 Hz" — no; what matters is the rate of the dataset you built, not of the log you cut it from. Down-sampling actions *together with the clock label* changes nothing about speed |


### Intuition for the last row

Filming a demonstration at 150 Hz and building a 15 Hz dataset is like shooting a
movie at 150 fps and printing every 10th still into the flipbook, writing "flip at
15 pages/s" on the cover. The film's frame rate is irrelevant once the pages are
chosen — only *page spacing vs. flip speed* decides how fast the scene plays.

Match the pair, and every other number in this document is infrastructure that just
works underneath you.

---

