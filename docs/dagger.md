# DAgger — Correcting a Policy Mid-Rollout

!!! abstract "Purpose / Audience:"
    For operators collecting correction data and engineers building
    the retraining dataset. How takeover works, what gets recorded, and how to extract the
    human-driven spans.


Run your policy, watch it work, and **grab an arm the moment it goes wrong** — your
correction is recorded in the same episode, labelled per step. Retrain on the corrections
(HG-DAgger) and the policy stops making that mistake.

---

## 1. Run it

```bash
soda run <policy_id> "pick up the bottle" --dagger
```

`--dagger` implies `--record` and the live console, records at **150 Hz** (a teleop demo's
step cadence), and starts a resident Quest teleop for takeover. It **fails closed**: no
headset / no clutch stream → the rollout does not start. Quest basics (pairing, hand
conventions): [quest-setup.md](quest-setup.md) ·
[data-collection-teleop.md](data-collection-teleop.md).

**Controller — per arm, the other arm stays with the policy:**

| Input | Effect |
|---|---|
| **Grip** (hold) | take the arm — it follows your hand while held (sticky clutch) |
| release Grip | the arm **parks** where it is (ratchet) — re-centre your hand, re-grab to continue |
| **A** (right) / **X** (left) | hand that arm **back to the policy** |
| **Trigger** | gripper. At takeover it is **locked**: squeezing tighter passes through, opening below where the gripper stood cannot happen — grabbing the clutch with a slack trigger never drops a held object. One full squeeze-and-release unlocks direct control (the release itself opens it). |

Ending the console (`q` / `Ctrl-C`) stops the policy and **saves the episode** — the save
blocks while the mp4s encode (scales with rollout length). Press **`f`** instead to stop
and **discard** the episode — no encode, nothing saved — for a run you already know is
garbage.

---

## 2. What gets recorded

**One episode for the whole rollout — policy-driven steps included** — under
`recordings/hdf5/<timestamp>/`, in exactly the format of a hand-driven teleop demo
(schema 2.1: `trajectory.h5` + `cameras/*.mp4` + `info.json` + `instruction.txt`).

**Who was driving is a per-step label, not a file boundary.** Every array in
`trajectory.h5` has length `T` (one entry per step), index-aligned:

| Dataset | Meaning |
|---|---|
| `action/controller_info/intervening` | `(T,)` bool — **`true` on the steps where a human drove at least one arm.** This is the teleop mask. |
| `action/controller_info/clutch_left` / `clutch_right` | `(T,)` bool — per-arm: was that Grip held |
| `action/human/<arm>/joint_position` · `gripper_position` | `(T,7)` / `(T,)` — the human's command. **NaN rows = nobody drove this arm that step** (NaN means "no output", never zero) |
| `action/policy/<arm>/…` + `action/policy/valid·tick·host_ts` | the policy's would-be command, recorded on **every** step — including while you drive (its counterfactual) |
| `action/<arm>/joint_position` · `gripper_position` | the command **in force**: the policy's while it drives, yours while you do — the same action semantics as a hand demo |
| `observation/*` | measured state (joints, velocities, torques), as always |

`info.json` and the HDF5 attrs carry `dagger: true`, so you can tell a DAgger rollout from
a plain demo without opening the HDF5.

---

## 3. Extracting the teleop spans

```python
import h5py, numpy as np

f = h5py.File("recordings/hdf5/<ts>/trajectory.h5", "r")

iv = f["action/controller_info/intervening"][:]    # (T,) bool — True = human driving
```

A rollout with two takeovers looks like:

```
step:  0  1  2  3  4  5  6  7  8  9  10 ...
iv:    F  F  F  T  T  T  F  F  T  T  F  ...
       └ policy ┘ └ human ┘ └pol┘ └hum┘
```

Per arm (the arms take over independently):

```python
hum_l = f["action/human/left/joint_position"][:]   # (T, 7)
left_by_human = ~np.isnan(hum_l).all(axis=1)       # (T,) — left arm human-driven?
```

**Building the correction dataset:** mask on `intervening` (or the per-arm masks). Drop
spans of only a few steps at build time — accidental grabs are no longer filtered at record
time. The policy-driven context *around* each grab (especially the steps just before it)
is in the same file — exactly the transition data that makes DAgger corrections effective.

---

## 4. Limits

- **Camera budget ≈ 3 minutes per episode** — frames buffer raw in RAM until save
  (~125 MB/s at 3 × 720p @ 15 fps); past the budget the video freezes (one
  backend-console warning) while joints, actions and the flags keep recording. Keep
  rollouts inside the window or split into sessions.
- `soda record stop fail` **discards the whole episode** — including every correction.
- Nothing is on disk until the save at stop; a crash mid-rollout loses the episode.

Destinations and the full recording matrix: [recordings.md](recordings.md) · running a
policy: [running-your-policy.md](running-your-policy.md).
