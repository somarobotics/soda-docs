# SODA — Running & Customizing Your Policy

Your model **weights never live on the robot.** You serve a checkpoint from your own GPU  
machine; the robot connects to it over a WebSocket, runs the real-time control loop, and  
applies the safety clamps. This page covers pointing the robot at your server, running a  
rollout, holding and tuning it, and — if you want — replacing the control logic.

---

## 1. Run, hold, resume, stop

```bash
soda run <policy_id> "pick up the bottle"   # bring up + start; then attaches a live console
soda pause                                  # HOLD — arms stop where they are, run keeps its state
soda resume                                 # continue, re-planning from the CURRENT pose (no lurch)
soda stop                                   # kill the WHOLE robot stack (launcher survives; `soda up` restarts)
```

`**soda run` attaches a live console** — it streams status and stays in the foreground.
`**q` or `Ctrl-C` stops just the policy and leaves the stack up** (so does `s` in `soda keys`), so you don't need `soda stop`. `soda stop` (identical to `soda estop`) kills every
stack process — backend, arm/cam servers, teleop, policy clients; only the launcher
survives, so `soda up` or the UI's **Launch** brings the stack back. Add `-d` to detach
(fire-and-forget); that's also the default when output isn't a terminal (scripts).

**Hold = `soda pause`.** The arms hold position and the rollout keeps its context; `soda resume` picks up from wherever the arms are *now*, so you can hand-correct the scene during
a hold and carry on. (In the UI or the `soda keys` console, `SPACE` toggles pause/resume.)

**Bring it up safely** — start in a non-moving mode, then escalate:

```bash
soda run <id> "..." --probe     # inference only, arms DO NOT move — confirm the model responds
soda run <id> "..." --dry-run   # full pipeline, motion still withheld
soda run <id> "..."             # live (default)
```

**Record a rollout (or DAgger demo).** Add `--record` to save the whole run — cameras +
state + actions — under `/opt/robot/recordings/hdf5/` (same format as a teleop demo,
but policy-driven). It implies `-i` (the live keyboard console), so you can **barge in
mid-rollout** — pause/resume, hand-correct — and those corrections land in the same
recorded episode. `--dagger` goes further: it **implies `--record`**, records at 150 Hz,
and enables sticky-clutch Quest takeover, so you can grab a correction with the
controllers mid-rollout — the whole rollout stays one episode, and your takeover spans
are flagged per step (`action/controller_info/intervening`). (`-d` suppresses the console
even with `--record`; the recording still runs.) Takeover controls, recorded fields and
how to extract the correction spans: `[dagger.md](dagger.md)` · file layout:
`[recordings.md](recordings.md)`.

```bash
soda run <id> "pick up the bottle" --record   # live rollout, saved as a demo episode
soda run <id> "..." --dagger                   # --record + 150 Hz + Quest takeover (DAgger)
soda run <id> "..." -i                         # live + keyboard barge-in console (no recording)
```

**If your client or console dies** mid-run, the arms drop after ~2 s to a gravity-
compensated **compliant hold** (soft, pushable, keeps its grip) and resume when commands
return — they never collapse.

---

## 2. Point the robot at your policy server

The robot finds your server through the **policy registry** — **one YAML file per policy**
under `/opt/robot/policies/policies/` on the unit (bind-mounted, survives updates). Each
file is one server plus how to talk to it; the filename stem is the id if you leave `id` out:

```yaml
# /opt/robot/policies/policies/my_pick_v1.yaml   —  one policy per file
id: my_pick_v1                  # unique key you pass to `soda run` (a–z, 0–9, _); defaults to the filename stem
name: "Pick v1"                 # label shown in the UI dropdown
type: openpi_ws                 # server type — openpi_ws (the openpi / pi0 / pi0.5 WebSocket)
host: "10.0.0.42"               # <-- your GPU server's IP
port: 8001                      # <-- its port
prompts:                        # task strings offered in the UI (you can also free-type)
  - "pick up the bottle"
image_mode: pad169              # pad169 | pad43 | stretch43 | stretch  (pad169 = default; table below)

# --- everything below is OPTIONAL — omit a field to take its default ---
action_space: auto              # auto | joint_pos | joint_vel | cart_pos | cart_vel | joint_impedance
gripper_source_open: 0.0        # policy value for "fully open"    (default 0.0)
gripper_source_close: 1.52      # policy value for "fully closed"  (default 1.52 — the legacy training convention)
# gripper_target_open / _close default from site.yaml gripper_max_position (GR100 ≈ 0.67) — set only to override
defaults:                       # per-run knobs prefilled when this policy is selected
  control_hz: 50.0              # command rate, Hz — 50 typical (Pi0.5 retrain has used 15)
  ensemble_decay: 0.1          # temporal chunk blend — 0 = off, higher = smoother/laggier (try 0.0–0.5)
  max_joint_delta: 0.05        # per-tick joint move cap, rad — lower = safer/slower (0.02–0.1)
  binarize_gripper: true       # true | false — latch the gripper fully open/closed (Schmitt)
```

**Only the fields you want to override need to be present** — anything omitted takes the
built-in default (`gripper_target_`* follows `site.yaml gripper_max_position`, etc.).

**To change the server IP/port**, edit `host` / `port` in that policy's file. The registry is
read fresh on every request, so the next `soda run` (or UI **Start**) picks it up — **no
restart needed.** The UI's **Add policy** / **✎** dialog writes and edits these files for you
(a new policy → a new `<id>.yaml` in that directory); factory policies that ship in the
image are read-only, your added ones are editable — and if one of your files reuses a
built-in id, **yours wins**. You can also `POST :8080/policy/registry`.

### Field choices

`**image_mode`** — how the real camera frame is fit to the model's 224×224 input. Match how
your checkpoint was trained:


| value       | what it does                                                                   |
| ----------- | ------------------------------------------------------------------------------ |
| `pad169`    | full-frame letterbox to 224, no distortion — **default**, matches OpenPI pi0.5 |
| `pad43`     | center-crop to 4:3 first, then letterbox — only if trained on 4:3              |
| `stretch43` | center-crop to 4:3, then squish to 224 — distorts (legacy)                     |
| `stretch`   | full 16:9 squished to 224 — distorts, A/B testing only                         |


`**action_space`** — leave at `auto` (detected from the chunk width) unless you know it's
mis-detected. Explicit options: `joint_pos` / `joint_vel`, `cart_pos` / `cart_vel`
(Cartesian — also set `orient_rep: quat`), or `joint_impedance` (the model additionally
outputs per-joint gains, so the arm runs variable-stiffness / compliant).

**Gripper values** — `*_source_`* is what your policy emits, `*_target_`* is the arm
command. `*_target_*` **defaults from** `site.yaml gripper_max_position` (GR100 open = 0.0 / close ≈ 0.67), so you usually omit them; and if your policy's config is different from that, you can set it through `gripper_source_open/gripper_source_close`. **Reversed ranges are fine** — e.g. a UMI parallel jaw in metres: `gripper_source_open: 0.085`,
`gripper_source_close: 0.0`.

---

## 3. Run your own checkpoint

Your checkpoint speaks the 14-DoF joint interface and the robot runs the loop for
you (chunk ensembling, filtering, safety clamps, homing):

1. Serve your checkpoint as an **openpi-compatible WebSocket server** on your GPU machine.
  Obs/action schema: docs/customer/[policy-serving.md](http://policy-serving.md)
2. Add a registry entry pointing `host` / `port` at it (section 2).
3. Run it, escalating probe → dry-run → live:

```bash
soda run my_pick_v1 "pick up the bottle" --probe   # then --dry-run, then live
```

`image_mode` must match how your checkpoint was trained (`pad169` = the OpenPI pi0.5
letterbox default). If the gripper opens when it should close, swap the `gripper_source_*`
range — reversed ranges (e.g. jaw-width in metres, open=0.085 / close=0.0) are supported.

---

## 4. Tune the behaviour

Two layers. **Live knobs** change mid-rollout, no stop:

```bash
soda params '{"max_joint_delta":0.03,"ensemble_decay":0.2,"binarize_gripper":true}'
```

Live-tunable: `max_joint_delta`, `max_gripper_delta`, `ensemble_decay`, `smooth_mincut`,  
`smooth_beta`, `binarize_gripper`, `exec_horizon`.

Rules of thumb: smoothing = `smooth_mincut` (lower = smoother / laggier) + `smooth_beta`;
temporal blend = `ensemble_decay`; per-tick motion cap = `max_joint_delta`; latch the
gripper fully open/closed = `binarize_gripper`.

---

## 5. Change the control logic — the open upper layer

**The file you edit is `/opt/robot/deploy/user_hooks.py`** — the one place on the robot
where your own control code goes. It hot-reloads on the next `soda run` and survives OTA
updates. Before diving in, know the boundary:


| Layer                                                                                                                                                | Changeable? | Where / why                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| Filters & shaping — 1-euro smoothing, chunk ensemble, gripper Schmitt, sag comp, gripper map                                                         | **Yes**     | `/opt/robot/deploy/user_hooks.py` PART 1 + the five hooks (below)        |
| Policy registration — server `host`/`port`, `action_space`, gripper mapping, per-run defaults (`control_hz`, `ensemble_decay`, `max_joint_delta`, …) | **Yes**     | `/opt/robot/policies/policies/<id>.yaml`, or live via `soda params` (§4) |
| Your policy server — weights, framework, inference code                                                                                              | **Yes**     | it runs on *your* machine; SODA is only a client                         |
| Per-unit operational config — boot mode, stiffness, ports, camera setup                                                                              | **Yes**     | `/opt/robot/config/site.yaml`                                            |
| Wire protocol / model I/O (msgpack-WebSocket contract)                                                                                               | **No**      | fixed platform contract — see [policy-serving.md](policy-serving.md)     |
| The control loop itself — rates, homing, chunk consumption                                                                                           | **No**      | sealed, compiled (`.so`); no source on the robot                         |
| Safety layer — per-tick clamps, absolute velocity ceilings, outlier rejection, joint limits                                                          | **No**      | always runs **after** your hooks; cannot be bypassed                     |
| Device-side guards — effort clamp, torque slew, SAFE-HOLD watchdog, gravity comp                                                                     | **No**      | enforced on the device for every client, every mode                      |


Inside `/opt/robot/deploy/user_hooks.py`:

- **PART 1** is SODA's actual differentiation logic — the 1-euro smoothing, chunk ensemble,
gripper Schmitt trigger, sag comp, and gripper map — transcribed to plain, editable NumPy
and numerically identical to what the robot runs. Read it, change it.
- **PART 2** is five **hooks**, commented out by default (so the robot runs its built-in
copy until you opt in). Uncomment one to make *your* edited filter run at that point:


| Hook                 | Runs                   | Sees                                                 |
| -------------------- | ---------------------- | ---------------------------------------------------- |
| `obs(obs, ctx)`      | before the model       | the observation sent to the checkpoint               |
| `chunk(chunk, ctx)`  | on raw model output    | the action chunk the model returned                  |
| `plan(plan, ctx)`    | on the joint plan      | the `(H, 14)` planned trajectory                     |
| `action(a14, ctx)`   | per tick, policy space | replaces the built-in smoothing + gripper binarize   |
| `target(cmd14, ctx)` | final real command     | the command about to go out, before the safety clamp |


The signature is always `name(x, ctx) -> x` (`return None` = "no change"). Whatever you
write, the **sealed safety clamp + rate limiter always run after it** — nothing here can
command an unsafe motion.

```python
# /opt/robot/deploy/user_hooks.py (PART 2) — shape the final command with your own sag comp
_sag = SagComp(ki=0.05, cap=0.08)
def target(cmd14, ctx):
    return cmd14 + _sag.update(cmd14, ctx.measured_real14())
```

Save the file and re-issue `soda run` (or `POST /policy/start`) — it **hot-reloads**, no
restart, and survives OTA updates.

---

## Quick reference


| Do this                 | How                                                                            |
| ----------------------- | ------------------------------------------------------------------------------ |
| Start a policy          | `soda run <id> "prompt"`                                                       |
| Record a rollout        | `soda run <id> "prompt" --record` (`--dagger` = record + Quest takeover)       |
| Hold / resume           | `soda pause` / `soda resume`                                                   |
| Stop the policy         | `q` / `Ctrl-C` in the console (saves the recording), or `s` in `soda keys`     |
| Discard a bad recording | `f` in the run console — stops the rollout, saves nothing (no encode)          |
| Stop the whole stack    | `soda stop` (launcher survives; `soda up` restarts)                            |
| Live-tune               | `soda params '{"...":...}'`                                                    |
| Change server IP        | edit `host` / `port` in that policy's `/opt/robot/policies/policies/<id>.yaml` |
| Change control logic    | edit `/opt/robot/deploy/user_hooks.py`, then re-`soda run`                     |
| List policies           | `soda list`                                                                    |


