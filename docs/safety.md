# Safety

## Stopping the robot — what each action actually does

| You do | What actually happens | Use it for |
|--------|----------------------|------------|
| **Pull the AC plug** | Arm power off, instantly — no software involved. **The arms go limp the moment power is cut and drop under their own weight.** For a planned shutdown or reset, home the arms or support them by hand before pulling; in an emergency, pull regardless. | **The emergency stop — and the routine power-off.** |
| **Software STOP** — `soda stop` (= `soda estop`), UI STOP | Kills every stack process (backend, arm/cam servers, teleop, policy clients) with no grace period. The launcher survives, so `:8079` stays reachable and `soda up` restarts the stack. | Software emergency stop — accepting the sag. |

No software path guarantees a stop unconditionally — it depends on the launcher being alive and
the firmware watchdog working. Treat the AC plug as the e-stop of record.

Planned shutdown sequence (zero-g → hand-pose to a safe posture → `soda stop` → unplug):
[operating-guidelines.md](operating-guidelines.md).

## Operating rules

- Run the browser UI on a **separate laptop**; keep the robot host headless.
- **Workspace clear** before any arm-moving (`⚠`) command: `soda home`, `soda move`,
  `soda replay play`, `soda smi --cmd-to-motion`, `soda calibrate`. See
  [soda-cli-reference.md](soda-cli-reference.md).
- Know where the AC plug is before the first powered motion of the day.
