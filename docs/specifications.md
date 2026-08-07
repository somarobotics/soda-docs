# Specifications

> **Purpose / Audience**: the verified numbers of this cell in one place, for operators and
> integration engineers. Everything here is grounded in the shipped software and control URDF —
> figures the software cannot verify are marked "confirm with your vendor".

---

## Layout

| Item | Value |
|------|-------|
| Arms | 2× Firefly Y6, 6-DOF revolute each |
| Gripper | 1× GR100 rotary gripper per arm (7th commanded DOF: per-arm layout `[j1..j6, gripper]`) |
| TCP / tool frame | `ee_link`, 187 mm from `gripper_base_link` along Z |
| Frame convention | left arm base = world origin; everything downstream is in the left base frame |

---

## Joint limits (per arm, control URDF)

| Joint | Axis | Limits (rad) |
|-------|------|--------------|
| joint_1 | 0 0 1 | −2.86 … 2.86 |
| joint_2 | 0 1 0 | −1.57 … 2.09 |
| joint_3 | 0 1 0 | 0 … 3.14 |
| joint_4 | 0 1 0 | −1.57 … 1.57 |
| joint_5 | −1 0 0 | −1.54 … 1.54 |
| joint_6 | 0 0 1 | −2.79 … 2.79 |

The URDF `effort` tags are placeholders, **not** actuator torque ceilings — see
[handover/dynamic-parameters.md](shipped-docs.md) for the full inertial model.

---

## Mass (per arm, from the control URDF)

| Quantity | Value |
|----------|-------|
| Moving links (link_1…link_6, incl. lumped gripper) | 3.970 kg |
| Total assembly (incl. fixed base) | 4.844 kg |
| Bimanual cell | 2× the above |

---

## Gripper (GR100)

| Item | Value |
|------|-------|
| Command range | 0.0 (open) → 0.67 rad (closed) |
| 0.67 source | `site.yaml` `gripper_max_position` — a **site-configured safe close**, not an absolute hardware limit |
| URDF joint envelope | 0 … 0.9 rad — the mechanical model's travel, deliberately decoupled from the command range: [handover/physical-model-and-calibration.md](shipped-docs.md) |

---

## Control & recording rates

| Loop | Rate |
|------|------|
| Arm control loop, configured (`control_hz`) | 500 Hz |
| Healthy measured rate (`soda smi --rate`) | ~499–500 Hz per arm |
| Acceptance floor | ≥ 485 Hz sustained, both arms |
| Teleop episode record rate (`--control-hz`) | 150 Hz default (target) |
| Backend session recorder | 60 Hz default · 120 Hz under `--dagger` |

---

## Cameras

| Camera | Model | Policy observation key |
|--------|-------|------------------------|
| Side | RealSense D435i | `cam_high` |
| Left wrist | RealSense D405 | `cam_left_wrist` |
| Right wrist | RealSense D405 | `cam_right_wrist` |

Policy input is always **224×224** RGB (`uint8`, CHW), letterboxed with `pad169`, regardless of
capture resolution (capture resolution is per-unit in `site.yaml`). Spec:
[integration/policy-io-contract.md](shipped-docs.md).

---

## Calibration acceptance

Hand-eye calibration order is left wrist → right wrist → side. Operator acceptance gate:
**< 5 mm** reported error per camera file; the internal auto-validation gate is stricter
(≈ 1 mm position RMSE). Details:
[handover/physical-model-and-calibration.md](shipped-docs.md).

---

## Policy interface

State is `float32 (14,)` — `[left j1..j6, left gripper, right j1..j6, right gripper]`. Accepted
action-chunk widths: **{14, 16, 20, 38, 40}**. Wire contract:
[integration/policy-io-contract.md](shipped-docs.md).

---

## Ports

Launcher/UI `8079`, backend API + WebSocket `8080`; ZMQ device sockets are loopback-only. The
canonical table is [integration/ports-and-planes.md](shipped-docs.md).

---

*Reach, payload, and repeatability are not derivable from the shipped software or URDF —
confirm with your vendor.*
