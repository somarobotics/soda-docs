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
  <div><b>14 DoF</b><span>2 × 6-joint arms + grippers</span></div>
  <div><b>3 cameras</b><span>RealSense, hand-eye calibrated &lt; 5 mm</span></div>
</div>

<div class="soda-group">start here</div>

<a class="soda-feature" href="getting-started/">
  <div class="soda-feature-head">
    <strong>Getting Started</strong>
    <span>unbox → running robot → the day-to-day routine</span>
    <em>open the guide →</em>
  </div>
  <ol class="soda-steps">
    <li><b>01 · install</b><span>One command on the robot host:<br><code>curl …/bootstrap.sh | bash</code></span></li>
    <li><b>02 · license</b><span>Email the shown fingerprint to your vendor; the installer takes the returned <code>license.json</code></span></li>
    <li><b>03 · launch</b><span>Open <code>http://&lt;robot&gt;:8079</code> in a browser and click <strong>Launch</strong></span></li>
  </ol>
</a>

<a class="soda-safety" href="safety/">
  <b>safety</b>
  <span>Before the first powered motion, read what each stop <em>actually</em> does — and the operating rules.</span>
</a>

<div class="soda-group">operate</div>

<div class="grid cards" markdown>

-   :material-tune:{ .lg .middle } **Control Modes**

    ---

    Stiff `position` vs compliant `joint_impedance`, and the one stiffness knob.

    [:material-arrow-right-thin: control-modes](control-modes.md)

-   :material-console:{ .lg .middle } **CLI Reference**

    ---

    The full `soda` command set — stack, robot, teleop, policy, replay, monitoring.

    [:material-arrow-right-thin: soda-cli-reference](soda-cli-reference.md)

-   :material-update:{ .lg .middle } **Software Updates**

    ---

    Silent OTA every 30 min, idle-aware, auto-rollback. Three recovery commands.

    [:material-arrow-right-thin: updates](updates.md)

</div>

<div class="soda-group">your policy</div>

<div class="grid cards" markdown>

-   :material-brain:{ .lg .middle } **Run Your Policy**

    ---

    Point the robot at your own checkpoint server; tune live; hook the control logic.

    [:material-arrow-right-thin: running-your-policy](running-your-policy.md)

-   :material-file-sign:{ .lg .middle } **Serving Contract**

    ---

    The wire protocol, action spaces, timing — everything a policy server must speak.

    [:material-arrow-right-thin: policy-serving](policy-serving.md)

</div>

<div class="soda-group">collect data</div>

<div class="grid cards" markdown>

-   :material-controller:{ .lg .middle } **Teleop & Recording**

    ---

    Quest dual-arm teleop → replayable HDF5 episodes.

    [:material-arrow-right-thin: data-collection-teleop](data-collection-teleop.md)

-   :material-hand-back-right:{ .lg .middle } **DAgger Corrections**

    ---

    Grab an arm mid-rollout; corrections are labelled per step in the same episode.

    [:material-arrow-right-thin: dagger](dagger.md)

-   :material-virtual-reality:{ .lg .middle } **Quest Headset Setup**

    ---

    One-time developer-mode prep, USB authorization, headset troubleshooting.

    [:material-arrow-right-thin: quest-setup](quest-setup.md)

-   :material-folder-play:{ .lg .middle } **Where Recordings Go**

    ---

    Episodes vs debug telemetry vs raw topic dumps — one map.

    [:material-arrow-right-thin: recordings](recordings.md)

</div>

<div class="soda-group">reference</div>

<p class="soda-links">
<a href="specifications/">Specifications</a> ·
<a href="glossary/">Glossary</a> ·
<a href="shipped-docs/">Integration &amp; Handover</a>
</p>
