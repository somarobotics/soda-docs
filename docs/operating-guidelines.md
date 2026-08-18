# Operating Guidelines

!!! abstract "Purpose / Audience"
    field-tested operating practices for the SODA cell — the habits
    and checks that prevent the common surprises. Collected from real operation; this page
    grows as experience accumulates.


## The Web UI

Need the UI? Just open **`http://<robot-host>:8079`** in a browser — the robot serves it,
nothing to install. Run the browser on a **separate laptop**, not on the robot host (loading
the host is the most common cause of control-loop jitter).

## Teleop

**Teleop starts fine, but moving the Quest controllers does nothing.** Two known causes,
in order of likelihood:

1. **The headset has no active session / the Quest-side app isn't running.** Put the
   headset on, log in to the account, then restart teleop
   (`soda teleop stop` → `soda teleop start`).
2. **A camera dropped out** — undetected or a loose connector. Run `soda smi` and check
   that all **three** cameras are present; re-seat the USB of any missing camera until all
   three are detected, then restart teleop.

**Keep both controllers inside the headset's tracking view** for the whole session. A
controller that leaves tracking can produce an unexpected surge when it re-acquires —
keep your hands where the headset can see them.

**Cable**: the headset — Quest 3S included — connects to the robot host over a **USB-C
data cable**. Setup and headset troubleshooting: [quest-setup.md](quest-setup.md).

## Powering off

Put the arms in a safe posture **before** cutting power — a powered-off arm drops under
its own weight ([safety.md](safety.md)):

```bash
soda zerog-on     # arms go weightless — hand-pose them into a low, supported posture
soda stop         # kill the stack
                  # now pull the AC plug
```
