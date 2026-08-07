# SODA — Customer Guide

For **operators and integration engineers**. Operate the cell, run your own policy,
integrate your model or a real-time client, and troubleshoot.

> ⚠️ **Real-hardware streaming caveat.** On real arms the high-rate state PUB publishes
> **`pos / vel / eff / joint_states` only**. `left/ee_pose`, `left/wrench`, and `left/tau_ext`
> (and the right-arm equivalents) do **not** publish in the current release — subscribing returns
> nothing. `ee_pose` is FK-derived and there is no 6-axis force sensor; "force" is per-joint
> motor effort.

---

## First boot

```bash
curl -fsSL https://somarobotics.github.io/soda-ota-channels/bootstrap.sh | bash   # first install (idempotent)
soda status                                                                      # verify
```

Then open `http://<robot-host>:8079` and click **Launch**. Full install walkthrough (including
an inspect-first alternative to `curl | bash`): [getting-started.md](getting-started.md). After a
manual `docker compose ... down`, restart with `docker compose -f /opt/robot/docker-compose.yml up -d`.

Config, calibration, recordings and logs live under `/opt/robot/**` and **survive updates**.
Run the Web UI on a separate laptop; keep the robot NUC headless.

---

## Guide

| # | Topic | Doc |
|---|-------|-----|
| 1 | **Get started** — unbox → install → day-to-day; first-boot options reconciled | [getting-started.md](getting-started.md) |
| 2 | **Safety** — e-stop reality, SAFE-HOLD limits, operating rules | [safety.md](safety.md) |
| 3 | **Operate** — control modes (`position` vs compliant `joint_impedance`) | [control-modes.md](control-modes.md) |
| 4 | **Operate** — the full `soda` CLI reference (stack / robot / teleop / teach / policy / replay / streams / smi / calibrate) | [soda-cli-reference.md](soda-cli-reference.md) |
| 5 | **Run YOUR policy** — point at your own openpi/pi0.5 checkpoint; Path A (registry) / Path B (own loop); `user_hooks`; action widths `{14,16,20,38,40}` | [running-your-policy.md](running-your-policy.md) |
| 6 | **Integrate (contracts)** — Plane-1 & Plane-2 wire specs, headless boot, ports | [integration/README.md](shipped-docs.md) |
| 7 | **Collect data / calibrate** — Quest teleop → HDF5 + MP4; hand-eye toolchain | [data-collection-teleop.md](data-collection-teleop.md) · [quest-setup.md](quest-setup.md) · [hand_eye_calibration](shipped-docs.md) · [handover/](shipped-docs.md) |
| 8 | **Where recordings go** — topic recordings vs runner `output/policy_runs` vs DAgger `recordings/hdf5` | [recordings.md](recordings.md) |
| 9 | **Updates** — silent auto-update, the 3 recovery commands, history/log paths | [updates.md](updates.md) |
| 10 | **Troubleshooting** — symptom → fix (`control_mode` 400, GRIP_HOLD, real-arm PUB caveat, `soda smi --rate`) | [troubleshooting.md](troubleshooting.md) |
| 11 | **Specifications** — verified numbers: joints, gripper, rates, cameras | [specifications.md](specifications.md) |
| 12 | **Network** — outbound endpoints for OTA, LAN ports | [network-requirements.md](network-requirements.md) |
| 13 | **Glossary** — Plane-1/2, GR100/GP100, SAFE-HOLD, DAgger, ... | [glossary.md](glossary.md) |

---

## Control modes at a glance

Arms boot in `position` (stiff) mode unless the unit's `/opt/robot/config/site.yaml` sets
`arms.<side>.control_mode: joint_impedance`. The UI / CLI / API change the mode at runtime;
`site.yaml` only sets where it starts. Details: [control-modes.md](control-modes.md) · full mode
table: [integration/ports-and-planes.md](shipped-docs.md).

---

## Bring your own policy — the short version

SODA hosts **no** model. You run an **openpi msgpack-WebSocket** server with your checkpoint; SODA's
managed runner dials out to it (Plane-1), or you drive the arms directly over ZMQ (Plane-2).

- Wire spec: [integration/policy-io-contract.md](shipped-docs.md)
- Register + run: [running-your-policy.md](running-your-policy.md)
- Customize control (filters, gripper, sag comp) without source: `/opt/robot/deploy/user_hooks.py`

---

*Documentation version: preview-2026-08-07*
