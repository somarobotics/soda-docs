# Safety

!!! abstract "Purpose / Audience"
    the canonical safety page for everyone near the cell — what each stop
    actually does, what SAFE-HOLD is (and is not), and the rules for attended and unattended runs.
    Other pages summarize; this page is the source of truth.


---

## Stopping the robot — what each action actually does

| You do | What actually happens | Use it for |
|--------|----------------------|------------|
| **Pull the AC plug** | Arm power off. Does not depend on any software being alive. | **The only guaranteed emergency stop.** |
| **Software STOP** — `soda stop` (= `soda estop`), UI STOP, or `POST :8079/launcher/estop` | Kills every stack process (backend, arm/cam servers, teleop, policy clients) with no grace period; signal delivery target < 50 ms. Torque cut is **indirect**: with the arm servers dead, the firmware watchdog stops being fed and the arm parks when its ~300 ms timeout expires. Motion ceases within roughly half a second, then the arms **sag under gravity**. The launcher survives, so `:8079` stays reachable and `soda up` restarts the stack. | Software emergency stop — accepting the sag. |
| **`POST :8080/robot/stop`** | An arbiter-latched software **HOLD** at the current position — the arm stays powered and stiff; other command sources are inhibited for 0.5 s. Requires a live backend. | Holding motion. **Not an emergency stop.** |

!!! warning
    The software STOP kills the robot stack; arm torque is cut by the firmware watchdog within
    about half a second and the arms sag under gravity — it is not a mechanical brake. The only
    guaranteed emergency stop is cutting arm power at the AC plug.


No software path guarantees a stop unconditionally — it depends on the launcher being alive and
the firmware watchdog working. Treat the AC plug as the e-stop of record.

---

## SAFE-HOLD — a compliant hold, not a brake

If a command stream goes silent for `idle_hold_max_ms` (per-unit `site.yaml`, default **2000 ms**),
the arm drops from "hold last command" to a **gravity-compensated compliant hold** of its measured
pose — a soft float you can push away that does not collapse. **The gripper stays clamped**, so a
grasped payload is not dropped. A fresh command exits SAFE-HOLD immediately.

Know its limits: it is not a brake, it holds nothing rigidly, and it only engages after the idle
window. Details for loop owners: [integration/zmq-device-contract.md](shipped-docs.md).

---

## Operating rules

- Run the browser UI on a **separate laptop**; keep the robot host headless.
- **Workspace clear** before any arm-moving (`⚠`) command: `soda home`, `soda move`,
  `soda replay play`, `soda smi --cmd-to-motion`, `soda calibrate`. See
  [soda-cli-reference.md](soda-cli-reference.md).
- Know where the AC plug is before the first powered motion of the day.

---

## Before an unattended run

- [ ] `site.yaml` `arms.<side>.idle_hold_max_ms` exceeds your longest legitimate command gap —
      and is **never `0`** (that disables SAFE-HOLD) for an unattended run.
- [ ] Fault report + clear verified working: `soda fault` / `soda clear`
      (`GET /robot/fault`, `POST /robot/clear_fault`) — recovery without a container restart.
- [ ] A supervising terminal (or physical access to power) stays on the e-stop:
      `soda estop` / `POST :8079/launcher/estop`. The launcher stays up for the whole run, but
      remember what the software STOP does — stack kill, watchdog torque cut, sag.

Full headless setup: [integration/headless-deploy.md](shipped-docs.md).
