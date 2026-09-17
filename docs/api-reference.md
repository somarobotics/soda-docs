# HTTP API Reference — Controlling the Robot from Code

Everything the UI can do, your code can do: the web UI is a pure client of the
HTTP API documented here. Base URL:

```
http://<robot-host>:8079
```

Port 8079 (the launcher) reverse-proxies `/robot`, `/policy`, `/camera`,
`/calibration`, and `/api/*` straight to the backend, and serves the
`/launcher/*` lifecycle endpoints itself — so one port is all you ever need.

**Two tiers of programmatic control:**

| Tier | Use it for | Where |
| --- | --- | --- |
| **REST (this page)** | Discrete actions & scripting: move-to, gripper, home, stiffness, reading state/cameras, orchestrating rollouts | `/robot/*`, `/policy/*`, `/camera/*`, … |
| **Streaming (50 Hz+ closed loop)** | Continuous control — serve actions from your own program over the policy WebSocket contract. It does **not** have to be a neural net: any server that returns action chunks works, and you inherit the full safety layer (per-tick clamps, velocity ceilings, watchdog, deadman) | [policy-serving.md](policy-serving.md) |

**Conventions**

- Dual-arm request bodies use the `arms` dict pattern — supply one arm to
  drive just that arm:

  ```json
  {"arms": {"left": {...}, "right": {...}}}   // both
  {"arms": {"left": {...}}}                   // left only
  ```

  Read endpoints return the same `{"left": ..., "right": ...}` shape.
- Angles are **radians**, positions are **meters**.
- **Single-writer arbitration**: while a rollout or teach session owns the
  arms, conflicting writes (e.g. `POST /robot/control_mode`) return **409**
  with the owner's name — stop that session first. This is deliberate: two
  writers on one arm is how hardware gets damaged.
- Every motion command passes the same safety layer the UI uses: joint
  limits, effort clamp + slew at the device, and the fault machinery.

---

## Lifecycle — `/launcher/*`

The launcher is always up (the container auto-starts on boot); the backend
starts on demand.

| Method & path | What it does |
| --- | --- |
| `GET /launcher/status` | Launcher/backend/hw state, mode, uptime |
| `POST /launcher/launch` | Start the backend (body selects `sim` / `real`) |
| `POST /launcher/stop` | Stop the backend (real mode goes through zero-gravity recovery) |
| `POST /launcher/estop` | Software E-stop. **Not** a substitute for pulling AC power |
| `POST /launcher/recovery/finish` | Acknowledge the recovery flow |
| `GET /launcher/logs` · `GET /launcher/metrics` | Recent backend logs / runtime metrics |
| `GET /launcher/safe-to-update` | `{"safe": true}` when the robot is idle (OTA gate; also handy as an "is anything running?" probe) |

---

## Arm control — `/robot/*`

### Read

| Method & path | Returns |
| --- | --- |
| `GET /robot/state` | Full per-arm state (joints, EE pose, gripper, moving/fault flags) |
| `GET /robot/joints` | Joint angles per arm |
| `GET /robot/ee_position` | End-effector position per arm |
| `GET /robot/limits` | Joint limits per arm |
| `GET /robot/control_mode` | Current control mode |
| `GET /robot/fault` | Fault state per arm |

### Motion

| Method & path | Body (per-arm payload inside `arms`) |
| --- | --- |
| `POST /robot/move/joints` | `{"joints": [rad × 6], "duration": s?}` |
| `POST /robot/move/position` | `{"x": m, "y": m, "z": m, "duration": s?}` |
| `POST /robot/move/pixel` | `{"u": px, "v": px, "depth": m?, "duration": s?}` — moves toward a pixel target on that arm's calibrated wrist camera (`depth` auto-read if omitted) |
| `POST /robot/gripper` | `{"action": "open"\|"close", "angle": rad?}` |
| `POST /robot/home` | Optional body: `{"home_position": [rad × 6]?, "duration": s?, "open_gripper": bool?, "arm": "left"\|"right"\|null}` — no body = configured home, both arms |
| `POST /robot/stop` | Stop current motion |

### Modes, stiffness, faults

| Method & path | Body |
| --- | --- |
| `POST /robot/control_mode` | `{"mode": "position"\|"joint_impedance", "arm": "left"\|"right"\|"both", "kp_scale"?, "kd_scale"?}` — `position` = stiff hold, `joint_impedance` = compliant spring-damper (e.g. `kp_scale: 0.3` for a soft arm). Safe to call while moving. Returns 409 while a rollout owns the arms |
| `POST /robot/stiffness` | `{"arm", "kp": [≥6]?, "kd": [≥6]?, "kp_scale"?, "kd_scale"?}` — runtime joint-space stiffness; gripper untouched |
| `POST /robot/ik/solve` | Solve IK without moving |
| `POST /robot/clear_fault` | Clear a latched fault |
| `POST /robot/torque` | `{"tau": [14]}` — one raw torque tick (`[L: τ×6+grip, R: τ×6+grip]`), streamed at your controller's rate. **Requires `torque` control mode, which is currently disabled** — the endpoint is reserved for a future release; use the streaming tier instead |

### Example — scripted pick, 15 lines

```python
import requests
R = "http://robot:8079"

def left(path, payload):
    return requests.post(f"{R}/robot/{path}", json={"arms": {"left": payload}}).json()

requests.post(f"{R}/robot/home")                                  # both arms home
left("move/position", {"x": 0.42, "y": -0.10, "z": 0.18})         # above object
left("move/position", {"x": 0.42, "y": -0.10, "z": 0.06})         # descend
left("gripper", {"action": "close"})
left("move/position", {"x": 0.42, "y": -0.10, "z": 0.20})         # lift
left("move/position", {"x": 0.25, "y": 0.15, "z": 0.20})          # carry
left("gripper", {"action": "open"})                               # release
requests.post(f"{R}/robot/home")
```

---

## Rollout orchestration — `/policy/*`

| Method & path | What it does |
| --- | --- |
| `GET /policy/list` | Selectable policies (built-in + user) |
| `POST /policy/registry` | Add/edit a policy entry (persisted to `/opt/robot/policies/`) |
| `DELETE /policy/registry/{id}` | Remove a user policy (built-ins refuse) |
| `POST /policy/start` | `{"policy_id", "prompt"?, "mode": "probe"\|"dry_run"\|"live", "overrides"?, "deadman_sec"?}` |
| `POST /policy/heartbeat` | Client-liveness ping. With `deadman_sec` set at start, a dead client auto-stops the rollout into a compliant idle-hold — **always use this pair from unattended scripts** |
| `POST /policy/stop` · `/pause` · `/resume` | Rollout lifecycle |
| `POST /policy/params` | Live-update soft tuning knobs mid-rollout (the `(live)` knobs in the policy template: `ensemble_decay`, `smooth_*`, `exec_horizon`, `handback_delay_s`, …) |
| `GET /policy/status` | Rollout state, step counter, timing |
| `GET /policy/view` | Live camera preview (`?cam=` `all`/`cam_high`/`cam_left_wrist`/`cam_right_wrist`, `?mode=pad169`) |
| `POST /policy/deny_human` | Recovery-only latch for a stuck teleop clutch during `--dagger`; non-operational — leave to the UI |

Policy file format (every field + defaults): the annotated
`/opt/robot/policies/example.yaml` on your robot, and
[policy-serving.md](policy-serving.md) for the wire contract your policy
server implements.

---

## Cameras — `/camera/*`

| Method & path | What it returns |
| --- | --- |
| `GET /camera/rgb?cam=left` | Current RGB frame (`cam` = `left`/`right`) |
| `GET /camera/depth?cam=left` | Current depth frame |
| `GET /camera/frame/info` | Frame metadata (resolution, timestamps) |
| `GET /camera/intrinsics` | Camera intrinsics |
| `GET /camera/calibration` | Hand-eye calibration in effect |
| `POST /camera/pixel_to_3d` | Pixel + depth → 3D point in the arm frame |
| `GET /camera/depth_at_pixel` | Depth value at a pixel |

---

## Calibration — `/calibration/*`

The guided flow `soda calibrate` uses these; scripting them is possible but
the console flow is the supported path.

| Method & path | |
| --- | --- |
| `GET /calibration/extrinsics` | Current extrinsics |
| `POST /calibration/start` · `/confirm_position` · `/cancel` | Drive a calibration session |
| `GET /calibration/status` · `/stream` | Progress / live view |

---

## Health — `/api/health`

| Method & path | |
| --- | --- |
| `GET /api/health` | Aggregate probe (consumed by OTA / Doctor) |
| `GET /api/health/safe-to-update` | Same gate as `/launcher/safe-to-update` |

---

## What is deliberately not exposed

The 500 Hz–1 kHz real-time device plane and the arm-vendor SDK/controller are
internal: they sit **below** the safety layer, and a second writer on the
controller's single SDK session makes the arms stop responding with no
useful error. If your use case seems to need them, tell us what you're
trying to achieve — in practice the streaming tier covers "run your own
controller" (any `action_space`, including velocity and impedance) while
keeping the clamps and watchdogs between your code and the hardware.
