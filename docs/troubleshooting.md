# Troubleshooting

!!! abstract "Purpose / Audience"
    — Operator symptom → fix guide for the SODA bimanual robot. For on-site operators running the shipped product; no source access required.


Find your symptom in a table below and apply the fix. Items marked **Expected** are by-design behavior, not faults — no action needed unless noted. For upgrade issues see [updates.md](./updates.md); for CLI details see [soda-cli-reference.md](./soda-cli-reference.md); for what listens on which port/topic see [integration/ports-and-planes.md](shipped-docs.md) and the [integration overview](shipped-docs.md).

---

## Motion & control modes

| Symptom | Likely cause | Fix |
|---|---|---|
| Setting `control_mode: torque` returns **HTTP 400 "raw torque mode is disabled for now"** | **Expected.** The torque route is intentionally disabled on the shipped build; only `position` and `joint_impedance` are accepted. | Use `position`, `joint_impedance`, or `cart_impedance`. Do not send raw torque. |
| `cart_impedance` "feels like" joint impedance | **Expected.** `cart_impedance` is an alias — the command is solved through IK to joint targets and run as `joint_impedance`. There is no on-device Cartesian loop. | None. Use it for compliant motion; expect joint-space, not Cartesian, stiffness. |
| Arm is **compliant / soft at boot** | **Expected if configured.** Arms boot in `position` (stiff) mode unless the unit's `/opt/robot/config/site.yaml` sets `arms.<side>.control_mode: joint_impedance` — if your arm is compliant at boot, your `site.yaml` opts into it by design. | Switch to `position` for rigid hold if the task needs it. The UI / CLI / API change the mode at runtime; `site.yaml` only sets where it starts. |
| Commanded move "does nothing" in a compliant mode | In `joint_impedance` / `cart_impedance` the measured pose lags the target, so small moves look like no motion. | Increase the move amplitude, or switch to `position` mode for a visible go-home / point-to-point. |

## Gripper

| Symptom | Likely cause | Fix |
|---|---|---|
| Gripper won't hold a part / drops it | Close was not commanded past the hold threshold, or hold torque is set to 0. | Command the gripper closed **past `gripper_hold_close_at` (0.5)**. It position-closes until contact (`\|vel\|<0.05` **and** `\|eff\|>2.0`), then latches to a torque hold at `gripper_hold_torque` (default **1.2**). Confirm `gripper_hold_torque > 0` in `site.yaml`. |
| Gripper **overheats / thermally trips** during a long hold | Running an **old image** without the torque-latch hold — a sustained position-close stalls the motor at high effort (~6.6) until it trips. | Update to the current release (see [updates.md](./updates.md)). The torque hold draws ~10× lower effort, so a continuous grasp no longer overheats. |

!!! note "Note:"
    There is **no 6-axis force/torque sensor**. Reported "force" is per-joint **motor effort**, and contact detection above is effort-based, not true grip force.


## Live data / feedback

| Symptom | Likely cause | Fix |
|---|---|---|
| Subscribing to **`.../ee_pose`, `.../wrench`, or `.../tau_ext`** (e.g. `left/ee_pose`) returns nothing on **real** arms | **Expected.** In the current release the real-arm publisher emits **`pos`, `vel`, `eff`, and `joint_states` only**; `ee_pose`/`wrench`/`tau_ext` are produced on the sim device only. | Use `joint_states` / effort. Compute end-effector pose from FK client-side if you need it (note: FK carries ~84 mm model error). |
| `soda smi --rate` reads below **~499–500 Hz** | Readings of **~499–500 Hz per arm** are healthy; anything **≥ 485 Hz sustained on both arms** passes acceptance. | Investigate only below **485 Hz sustained**: keep the UI browser off the robot NUC and reduce host load (see "UI & video"), then re-measure. |
| Not sure the control loop is running fast enough | Need a trustworthy live rate. | Run the passive PUB rate check (below). |

**Check the loop rate:**

```bash
soda smi --rate
```

Expect **~499–500 Hz on both arms** (acceptance floor: **≥ 485 Hz sustained**). `--rate` reads the live publisher passively and is the number to trust for acceptance. Do **not** judge health from `--probe` (it under-counts on a live backend); `--cmd-to-motion` physically moves joint 0, so only run it with the workspace clear. See [soda-cli-reference.md](./soda-cli-reference.md).

## Safety, parking & e-stop

| Symptom | Likely cause | Fix |
|---|---|---|
| Arm **sags / drifts** when left idle, or can be pushed by hand | **Expected.** After ~2 s (`idle_hold_max_ms` 2000) with no fresh command, SAFE-HOLD does a **gravity-comp compliant hold** of the current pose (gripper clamped). It is **not a mechanical brake** and will yield to external load. | Send fresh commands to keep active control. Do not rely on SAFE-HOLD to bear load or as a safety stop. |
| Arm suddenly **parks / stops on its own** under host load | A real-time comms timeout (arm firmware `PscApiCommunicationTimeout`) triggers a proactive parking-stop. | Keep the browser UI off the robot NUC (see below) and avoid heavy host load. If it recurs, report it — RT isolation may need re-checking. |
| Need to **stop the robot immediately** | SAFE-HOLD and mode switches are software holds, not emergency stops. | Use the software STOP (`soda stop` / the UI STOP) to kill the robot stack — motion ceases within roughly half a second, then the arms sag. For a guaranteed stop, **cut arm AC power at the plug**. There is no software command that guarantees a motion stop. See [safety.md](./safety.md). |

!!! warning "Note:"
    The software STOP kills the robot stack; arm torque is cut by the firmware watchdog within about half a second and the arms sag under gravity — it is not a mechanical brake. The only guaranteed emergency stop is cutting arm power at the AC plug. Full details: [safety.md](./safety.md).


## UI & video

| Symptom | Likely cause | Fix |
|---|---|---|
| UI video is **blank / stutters**, streams pile up, robot gets choppy | Running the **browser on the robot NUC itself** leaks camera streams and steals CPU/GPU from control. | **Run the UI browser on a separate laptop** and keep the NUC headless. This is the standard operating setup. |
| Viewport shows **no 3D robot model** (F12 console: `URDF 404`) | Image is missing UI static assets. | Update to a current release ([updates.md](./updates.md)); the fix ships in the image. |
| Home / Teleop button shows an "error" | Often **HTTP 409** — the state machine is refusing in the current state (e.g. teleop before homing), not a real fault. `200` may also mis-toast as an error. | Home first, then retry. Check the viewport for the actual effect. `503` means the backend is still starting — wait. |
| **Side-camera point cloud missing** (only wrist clouds show) | Calibration file for the side camera is absent. | See "Calibration" below. |

## Container & startup

| Symptom | Likely cause | Fix |
|---|---|---|
| Container **restart-loops** at boot, logs mention license | License file missing, signature invalid, or signed for a different machine. | Confirm `/opt/robot/license.json` exists and was signed for **this** machine's fingerprint; re-issue if hardware-mismatched. See [updates.md](./updates.md). |
| Container **restart-loops**, logs say `site.yaml not found` | First-boot config never created. | Run the setup wizard: `docker exec -it robot-backend-1 python -m soda_os.tools.site init`. |
| `docker compose up` fails with `manifest unknown` then tries to build | `ROBOT_VERSION` not set, so it resolves to a non-existent tag. | Ensure `/opt/robot/.env` sets `REGISTRY` and `ROBOT_VERSION`, then `docker compose -f /opt/robot/docker-compose.yml up -d`. |
| `/launcher/status` says backend up but nothing responds correctly | A **second SODA instance** is running on the host (host + container both bound to `:8080`). | Run only one instance. Stop the stray host process, then `docker compose -f /opt/robot/docker-compose.yml down && docker compose -f /opt/robot/docker-compose.yml up -d`. See [integration/ports-and-planes.md](shipped-docs.md). |
| Version changed / config stopped applying by itself | The OTA timer auto-swapped the image on schedule. | Normal for the stable channel. To pin during on-site work, pause OTA — see [updates.md](./updates.md). |

## Calibration

| Symptom | Likely cause | Fix |
|---|---|---|
| **Point clouds misaligned or side-cam cloud gone after swapping a camera** | Hand-eye calibration is tied to the specific camera and its mounting; a swap invalidates it. | **Re-run hand-eye calibration** for the affected camera, then restart the backend. |
| Side-camera point cloud never appears (no camera swap) | `/opt/robot/calibration/dual/side.json` (or the other hand files) is missing — a bind mount overrode the image copy. | Ensure `/opt/robot/calibration/dual/{left_hand,right_hand,side}.json` are all present, then restart the backend. |
| Startup reports a **camera serial mismatch** | A replaced camera reports a new serial that no longer matches `site.yaml`. | Update the camera serials via `site init` / `site validate`, then restart. |

**Restart the backend after calibration or config changes:**

```bash
docker compose -f /opt/robot/docker-compose.yml restart backend
```

---

Still stuck? Capture `soda smi --rate`, the backend logs, and the exact symptom before escalating. For upgrade and rollback procedures see [updates.md](./updates.md); for the CLI see [soda-cli-reference.md](./soda-cli-reference.md); for ports, topics, and network planes see [integration/ports-and-planes.md](shipped-docs.md) and the [integration overview](shipped-docs.md).
