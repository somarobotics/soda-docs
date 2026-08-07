# Glossary

> **Purpose / Audience**: short definitions of the terms the SODA docs use, with links to the
> page that owns each topic. Alphabetical.

**Action chunk / temporal ensemble** — one policy inference returns a *chunk* of `H` future
steps (`(H, 14)` for the default action space); the managed runner blends overlapping chunks
with an ACT-style temporal ensemble and consumes them at the control rate.
See [integration/policy-io-contract.md](shipped-docs.md).

**Clutch** — in Quest teleop, the **grip squeeze** (held) that makes an arm follow your hand;
release lets go without moving the arm, and each new press re-anchors to the arm's current pose.
The index trigger never moves the arm — it drives only the gripper.
See [data-collection-teleop.md](data-collection-teleop.md).

**DAgger** — `soda run <policy> --dagger`: a policy rollout where you can take over with the
Quest mid-run (sticky clutch); the executed trajectory plus `action/policy` and `action/human`
shadow streams are saved as **one** episode (recorded at 120 Hz), used to collect corrections
for retraining. See [recordings.md](recordings.md).

**Episode (HDF5)** — one recorded attempt: 14-dim state + action, timestamps, and video, stored
under `/opt/robot/recordings/hdf5/` (schema 2.1) and replayable with `soda replay`.
See [recordings.md](recordings.md).

**GP100** — an older HexArm rotary gripper whose 0.0 → 1.52 rad open→close range became the
historical training-data convention; the policy registry's `gripper_source_*` defaults
(0.0 / 1.52) come from it.

**GR100** — the rotary gripper on this cell, one per arm. Commanded from 0.0 (open) to
`site.yaml` `gripper_max_position` (0.67 rad here — a configured safe close, not an absolute
hardware limit). `GripperMap` affinely maps policy (source) ↔ arm (target) ranges.
See [specifications.md](specifications.md).

**Hand-eye calibration** — the ChArUco-based procedure that solves each camera's pose relative
to the robot (wrist cameras: `T_cam2gripper`; side camera: `T_cam2base` plus the inter-arm
transform). Results land in `/opt/robot/calibration/dual/` and survive OTA.
See [handover/physical-model-and-calibration.md](shipped-docs.md).

**openpi / pi0.5** — the model-serving convention SODA's managed runner speaks: an openpi-style
msgpack-WebSocket policy server (your process, your weights) answers one observation with one
action chunk; pi0.5 is a checkpoint family commonly served this way.
See [integration/policy-io-contract.md](shipped-docs.md).

**OTA** — over-the-air update. The unit checks its channel file (default `stable.txt`) every
30 minutes (first check ~2 min after boot) and pulls new images from `ghcr.io`.
See [updates.md](updates.md) · [network-requirements.md](network-requirements.md).

**Plane-1** — the managed / supervisory plane: soda_os owns the loop; HTTP + WebSocket on
`:8079` / `:8080`; the Web UI, `soda` CLI, and managed policy runner live here.
See [integration/ports-and-planes.md](shipped-docs.md).

**Plane-2** — the real-time device plane: your own client owns the 500 Hz–1 kHz loop directly
on the loopback ZMQ device sockets.
See [integration/zmq-device-contract.md](shipped-docs.md).

**Policy registry** — the per-policy YAML store the managed runner reads. Built-ins ship
read-only in the image; your entries are one YAML per policy at
`/opt/robot/policies/policies/<id>.yaml`, re-read on every request (no restart needed).
See [running-your-policy.md](running-your-policy.md).

**SAFE-HOLD** — the client-death watchdog: after `idle_hold_max_ms` (default 2000 ms) with no
fresh command, the arm drops to a gravity-compensated **compliant** hold of its measured pose;
the gripper stays clamped. A hold, not a brake. See [safety.md](safety.md).

**site.yaml** — the per-unit configuration at `/opt/robot/config/site.yaml`: ports, boot
control mode, `gripper_max_position`, `idle_hold_max_ms`, arm spacing, camera settings. It
survives updates.

**SODA** — the robot's operating software: device servers, backend (API + WebSocket), Web UI,
and the `soda` CLI, shipped as one Docker image. See [README.md](index.md).

**Teach / zero-g** — gravity-compensated freedrive: the arms go compliant so you can hand-pose
them (`soda teach on|off`, `soda zerog-on/off`). Used for hand-posing and calibration.
See [soda-cli-reference.md](soda-cli-reference.md).
