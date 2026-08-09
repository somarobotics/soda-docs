# Control Modes

!!! abstract "Purpose:"
    Understand what a control mode does to the arms and how to switch it.
    **Audience:** Operators running a SODA bimanual cell.


A **control mode** decides how *firmly* an arm holds its target position.

- **Stiff (position)** — the arm locks onto its target and resists being pushed. Accurate, but it will fight anything in its way.
- **Compliant (joint_impedance)** — the arm still moves to its target, but softly. Push it and it gives; let go and it returns. Safer for contact, people, and unknown obstacles.

Both modes reach the same targets. They differ only in how hard the arm pushes to get there and how much it resists being moved.

## Boot default

Arms boot in **`position` (stiff)** mode unless the unit's `/opt/robot/config/site.yaml` sets `arms.<side>.control_mode: joint_impedance`. The UI / CLI / API change the mode at runtime; `site.yaml` only sets where it starts.

**For contact work, we recommend compliant.** Switch to `joint_impedance` (or opt into a compliant boot in `site.yaml`, below) for teleop, data collection, and any task involving contact — an arm that touches something yields instead of shoving. Use `position` when you need a stiff, precise hold.

## The stiffness knob

`stiffness_scale` is the single dial for how firm an arm feels — it scales both the position gain and damping together.

| Value | Feel |
|---|---|
| `1.0` | Default firmness |
| `< 1.0` (e.g. `0.1`) | Softer, gives more easily |
| `> 1.0` | Stiffer, resists more |

In compliant mode this sets the compliance level. Softer = safer and easier to hand-guide; stiffer = more accurate tracking.

## How to switch

Any of these work — pick whichever fits the moment.

**CLI (this session):**
```bash
soda mode position              # stiff hold
soda mode impedance 0.3         # compliant at 30% stiffness
```

**UI:** use the control-mode selector on the arm panel.

**Boot default (`site.yaml`, per arm):**
```yaml
arms:
  left:
    control_mode: joint_impedance   # opt into a compliant boot (factory default: position)
    stiffness_scale: 1.0
```
The UI / CLI / API change the mode at runtime; `site.yaml` only sets where the arm starts.

See [`./soda-cli-reference.md`](./soda-cli-reference.md) for full command syntax.

## Which mode when

| You want to… | Use |
|---|---|
| Teleop, demo collection, tasks that touch things | `joint_impedance` (compliant) — recommended |
| Hand-guide or free-pose the arm | `joint_impedance`, low `stiffness_scale` |
| Precise, repeatable positioning with no contact | `position` (stiff) |

## Modes you don't manage

- **`torque` is disabled.** Requesting it is rejected (HTTP 400). Raw torque control is not available for operators in the current release.
- **`cart_impedance` is automatic.** When a task specifies a Cartesian (end-effector) target, the system runs it as compliant Cartesian motion for you — there's nothing to select.

---

For the engineering deep-dive (the one MIT law, gain regimes, REST surface), see [`../developer/control-modes.md`](shipped-docs.md).
