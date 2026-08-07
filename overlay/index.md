---
hide:
  - navigation
  - toc
---

<div class="soda-hero" markdown>

<span class="soda-led"><i></i>operator docs · live</span>

# SODA <span class="au">Dual-Arm</span>

**A tabletop dual-arm robot that runs itself — and runs *your* policy.**

One Docker image. Boots on power-up. Updates silently, rolls back on failure.
Your model weights never leave your own GPU server.

[Get started :material-arrow-right:](getting-started.md){ .md-button .md-button--primary }
[Read safety first](safety.md){ .md-button }

```bash
curl -fsSL https://somarobotics.github.io/soda-ota-channels/bootstrap.sh | bash
```

</div>

<div class="soda-stats">
  <div><b>500 Hz</b><span>control loop, per arm</span></div>
  <div><b>≥ 485 Hz</b><span>acceptance floor — verify it yourself with <code>soda smi --rate</code></span></div>
  <div><b>14 DoF</b><span>2 × 6-joint arms + grippers</span></div>
  <div><b>3 cameras</b><span>RealSense, hand-eye calibrated &lt; 5 mm</span></div>
</div>

<div class="grid cards" markdown>

-   :material-rocket-launch:{ .lg .middle } **Getting Started**

    ---

    Unbox → one-command install → running robot, and the day-to-day routine.

    [:material-arrow-right-thin: getting-started](getting-started.md)

-   :material-alert-octagon:{ .lg .middle } **Safety**

    ---

    What each stop *actually* does, SAFE-HOLD's limits, rules for unattended runs.

    [:material-arrow-right-thin: safety](safety.md)

-   :material-tune:{ .lg .middle } **Control Modes**

    ---

    Stiff `position` vs compliant `joint_impedance`, and the one stiffness knob.

    [:material-arrow-right-thin: control-modes](control-modes.md)

-   :material-console:{ .lg .middle } **CLI Reference**

    ---

    The full `soda` command set — stack, robot, teleop, policy, replay, monitoring.

    [:material-arrow-right-thin: soda-cli-reference](soda-cli-reference.md)

-   :material-brain:{ .lg .middle } **Run Your Policy**

    ---

    Point the robot at your own checkpoint server; tune live; hook the control logic.

    [:material-arrow-right-thin: running-your-policy](running-your-policy.md)

-   :material-controller:{ .lg .middle } **Teleop & Data Collection**

    ---

    Quest dual-arm teleop → replayable HDF5 episodes.
    Plus [headset setup](quest-setup.md) and [where recordings go](recordings.md).

    [:material-arrow-right-thin: data-collection-teleop](data-collection-teleop.md)

-   :material-update:{ .lg .middle } **Updates**

    ---

    Silent OTA every 30 min, idle-aware, auto-rollback. Three recovery commands.

    [:material-arrow-right-thin: updates](updates.md)

-   :material-wrench:{ .lg .middle } **Troubleshooting**

    ---

    Symptom → fix tables, including which behaviors are by-design.

    [:material-arrow-right-thin: troubleshooting](troubleshooting.md)

-   :material-book-open-variant:{ .lg .middle } **Reference**

    ---

    [Specifications](specifications.md) · [network requirements](network-requirements.md) ·
    [glossary](glossary.md) · [integration & handover](shipped-docs.md)

</div>
