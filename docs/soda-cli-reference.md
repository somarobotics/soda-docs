# SODA headless CLI (`soda`)

---

## Stack

```
soda up [real|sim]     # boot the stack (default: real)
soda status            # stack + policy status (mode, per-service health)
soda version           # CLI + backend versions (warns on a mismatch)
soda stop              # STOP — kill every stack process   (alias: soda estop)
```

**Zero-gravity float** — go limp so you can hand-move the arms:

```
soda zerog-on              # float the arms (teach-style; needs the backend up)
soda zerog-off             # end the float
soda zerog-on  --recover   # backend is dead (e.g. after `soda stop`) -> launcher zero-gravity
soda zerog-off --recover   # end that launcher float
```

## Robot

```
soda home                                     # both arms → home (smooth)
soda gripper open|close [left|right|both]     # default both
soda state                                    # joints, EE pose, control_mode (JSON)
soda move joints '{"left":[..6..]}'           # ⚠ joint target
soda move pose   '{"left":[x,y,z,...]}'       # ⚠ EE target (posts to /robot/move/position)
soda mode position | impedance [<scale>|<kp> <kd>] | stiffness <scale>   # see below
```

### Control mode & stiffness

Runtime overrides (safe while moving). The **boot** defaults come from `site.yaml`
(`arms.<side>.control_mode`, `stiffness_scale`; factory default mode: `position`).
One scale sets kp+kd together; two scales set them separately (kd defaults to kp).


| command               | behaviour                                                          |
| --------------------- | ------------------------------------------------------------------ |
| `soda mode position`  | stiff firmware position hold — runtime kp/kd do **not** apply here |
| `soda mode impedance` | compliant joint-impedance PD — this is the mode where kp/kd matter |


Gain tables (scales, firmware defaults, per-joint vectors via the API):
[control-modes.md](control-modes.md).

## Teleop + data collection

`soda teleop start` starts Quest teleop **and drops into a live console** — recording is
the same console, not a separate step.

```
soda teleop start | console    # start Quest teleop → the console below / re-attach it
soda teleop stop | status
```

Console — single keypress, no Enter:

```
r  record on / off  (a plain stop saves as SUCCESS)      h  home the arms
s  save SUCCESS + stop                                    t  set task text for next episode
f  discard (FAILURE)                                      l  list episodes   ·   i  status
q  or  Ctrl-C   →   stop teleop AND quit
```

Episodes → `**/opt/robot/recordings/hdf5/<timestamp>/**` (cameras `.mp4` + state/action HDF5).
**Saving freezes the control loop while it encodes — hold still until you see `✓ ready`.**

## Teach (hand-guide)

```
soda teach on | off | status     # arms go compliant → move them by hand; off holds the pose
```

## Policy

```
soda run <id> [prompt...] [--probe|--dry-run] [--record] [--dagger]
                                 # bring-up + start in one command
soda pause | resume              # policy-level: pause holds without ending; resume re-plans
                                 # from the current pose
soda list | params '<json>'      # list policies · live-tune knobs

```

`soda run` flags:

- `**--record**` — starts episode recording **and** implies the live console.
- `**--dagger`** — implies `--record`; records at 150 Hz (teleop's step cadence) and enables sticky-clutch Quest  
takeover. The whole rollout is saved as **one** episode; takeover spans are flagged  
per step (`action/controller_info/intervening`), not split into separate files.

## Replay ⚠ moves the arms

```
soda replay list                 # one episode per line
soda replay load <ep>            # load an episode for playback
soda replay play [<ep>]          # ⚠ enter replay → LIVE progress bar → back to realtime
soda replay play <ep> --record   # also save the run as a NEW episode under recordings/hdf5/
soda replay pause                # pause playback
soda replay step [fwd|back]      # single-step (default: fwd)
soda replay seek <n>             # jump to step n
soda replay status               # loaded episode + playback position
```

## Streams

Subscribe to the live ZMQ device topics — like `rostopic echo` / `rqt_image_view`.

```
soda stream --sub <topics> [--http PORT] [--save DIR] [--record [DIR]]
```

`--sub` is a **prefix** — the shortest unique prefix matches, `""` = everything.

### State topics → printed as numbers

Full name is `<side>/<name>`, `<side>` = `left` or `right`. Payload =
`[device_ts, host_ts, …values]`.


| topic                        | contents                                                 |
| ---------------------------- | -------------------------------------------------------- |
| `<side>/pos` · `vel` · `eff` | joint position / velocity / effort (7 = 6 arm + gripper) |
| `<side>/joint_states`        | pos+vel+eff in one (21) — like `sensor_msgs/JointState`  |
| `<side>/tau_ext`             | external joint torque (measured − modeled gravity)       |
| `<side>/ee_pose`             | `[x,y,z, qx,qy,qz,qw]` (xyzw quaternion)                 |
| `<side>/wrench`              | `[fx,fy,fz, mx,my,mz]` Cartesian force estimate          |


On real hardware the current release publishes `pos` / `vel` / `eff` / `joint_states` only;
`ee_pose` / `wrench` / `tau_ext` stream on the sim device.

```
soda stream --sub left/wrench        # one topic
soda stream --sub left               # every left-arm topic (prefix)
soda stream --sub ""                 # everything
```

### Camera topics → view or save (JPEG, don't print)

`cam` = all three, `cam/side` = side, `cam/left` matches `cam/left_wrist`. Camera **topics** are `left_wrist`, `right_wrist`
(⚠ **not** `left` / `right`), and `side` — a different namespace from the short names
`soda cam` takes.

`soda stream` **prints** by default — add one flag to view or keep the data (they combine, e.g.
`--http --record` views *and* records):


| flag             | example                                    | what you get                           |
| ---------------- | ------------------------------------------ | -------------------------------------- |
| `--http PORT`    | `soda stream --sub cam --http 8090`        | browser viewer at `http://<host>:8090` |
| `--save DIR`     | `soda stream --sub cam --save /tmp/frames` | **images only** — raw JPEG frames      |
| `--record [DIR]` | `soda stream --sub "" --record`            | **full capture** — one folder (below)  |


```
recordings/topics/<ts>/
├── topics.h5                                # all subscribed STATE topics
├── cam_<name>_image_compressed/  (+ .mp4)   # each camera: JPEG frames + an mp4
└── meta.json                                # per-topic frame counts
```

Stop with **Ctrl-C** — the mp4/meta are written **on close**, so don't `kill -9`. `--record` with no
dir uses the default (see [recordings](recordings.md)).

`**(no frames)`?** A topic streams only if its `pub_port` is in `site.yaml` — arms
`arms.<side>.pub_port` (12348 / 12349), cameras `cameras.<name>.pub_port` (per-unit values in `site.yaml`). Check the `endpoints=[…]` line it prints on
start, or point at ports directly: `soda stream --sub cam --http 8090 --pub-ports <p1>,<p2>,<p3>`.
(Sim cameras stream ~1–5 Hz.)

## Monitoring — `soda smi`

An `nvidia-smi`-style panel for the control loop. `-l N` refreshes like `nvidia-smi -l N`; add
`--json` for machine-readable output.


| command                    | reports                                                                                                                                                         | impact                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `soda smi`                 | system + RT panel: per-proc CPU/mem, per-core %busy, which core each arm's control loop is pinned to (+ sched / priority), camera fps, policy inference latency | passive — **zero impact** |
| `soda smi --rate`          | **loop rate + jitter** (Δt p50/p95/p99/max) + sensor→host latency, per arm                                                                                      | passive — **zero impact** |
| `soda smi --probe`         | active REQ/REP round-trip latency                                                                                                                               | active, no motion         |
| `soda smi --cmd-to-motion` | command→motion latency (nudges a joint, times to onset)                                                                                                         | ⚠ **moves the arm**       |


**Which one:**

- `**--rate`** — the number to trust for loop rate / jitter / sensor→host: a lean passive subscriber
that keeps up with the full publish rate. Use it for acceptance, any time, even mid-rollout.
- `**--probe**` — actively round-trips the arm's REQ/REP control channel; reliable **only as the sole
client**. With the backend running it is contended and undercounts (it warns, and points you to `--rate`).
- `**--cmd-to-motion`** — physically nudges one joint (~0.05 rad) and times to motion onset. Clear the
workspace; it requires the explicit `--i-understand-this-moves-the-robot` flag.
- `**soda smi**` (no flag) — the health panel (CPU / cores / loop pinning); confirm the RT setup is
active. **Not** the loop-rate source — that is `--rate`.

## Calibration ⚠ moves the arms

One guided console walks the whole hand-eye flow in order — LEFT wrist → RIGHT wrist → SIDE camera.

```
soda calibrate                                 # guided console, full flow (left → right → side)
soda calibrate start [left|right|side|all]     # same, or just one target
soda calibrate <target> confirm|status|cancel|watch   # advanced one-shots (scripting)
```

Per pose: the arm floats (zero-gravity) so you hand-pose it, a LIVE line shows the ChArUco corner
count (aim for ≥ 6 — the “in view” marker lights when it’s enough), `[Enter]` locks the pose and runs
that camera’s sweep with a progress bar, then it auto-advances. A prominent reminder appears before
the SIDE camera: LEFT and RIGHT must be calibrated first (the side extrinsic is solved relative to both).

## Camera grab · faults

```
soda cam rgb|depth [left|right|side] [outfile]   # single shot → /tmp/soda_<side>.jpg
soda fault | clear                               # show / clear latched faults
```

`soda cam` takes the **short** camera names `left|right|side`; the stream topics
(`left_wrist` / `right_wrist` / `side`) are a different namespace.
