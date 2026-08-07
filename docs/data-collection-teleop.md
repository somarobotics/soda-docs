# Data Collection — Quest Dual-Arm Teleop

> **Purpose / Audience:** Operator guide to driving both arms with two Meta Quest 3 controllers and recording demonstration episodes for training.

Two controllers, two arms: the **right** controller drives the **right** arm, the **left** drives the **left**. You hold the clutch to move, release to let go, and record each attempt as one episode (HDF5 + video).

---

## 1. Before you start

You need the stack running and the Quest visible over USB.

```bash
soda up real            # boot launcher :8079 + backend :8080 + drivers
soda status             # arms/cameras report ready
adb devices             # your Quest must appear as a device
```

- **Quest:** Developer Mode on, USB-C **data** cable (not charge-only), and accept the *Allow USB debugging* prompt in the headset — the headset must appear in `adb devices`. That is all: on start the teleop stack auto-installs the bundled teleop app over adb and auto-launches it — no manual sideload, no in-headset launch. Once running, keep the teleop app in the background — do not force-quit it. First time with this headset (Developer Mode, USB authorization, Wi-Fi option, headset troubleshooting): **[quest-setup.md](quest-setup.md)**.
- **Cameras:** the record cameras (default `left`, `right`, `side`) must be up in `soda status`.

---

## 2. The teleop loop

Start teleop and drop straight into the collection console:

```bash
soda teleop start       # starts Quest teleop + the live console (soda collect re-attaches it)
soda teleop stop | status
```

On start, both arms smooth-home and the loop waits for you to engage the clutch.

### Controller buttons


| Control        | Button                    | What it does                                                                                                                                                                                      |
| -------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Clutch**     | **Grip squeeze** (hold)   | Hold to move the arm. Your controller motion maps to the end-effector. **Press** re-anchors the reference to the arm's current pose; **release** goes silent so the UI or a policy can take over. |
| **Gripper**    | **Index trigger** (analog)| Pull to close, ease off to open (0-1 continuous).                                                                                                                                                 |
| **Home right** | **A**                     | Homes the **right** arm.                                                                                                                                                                          |
| **Home left**  | **X**                     | Homes the **left** arm.                                                                                                                                                                           |


Each controller homes **its own** arm. **Keep the controllers inside the headset cameras' view.**

**How to move:** squeeze and hold the **grip** — that is the clutch — move your hand, and the arm follows in the base frame. Release the grip, reposition your hand comfortably, squeeze again — the arm does **not** jump, because each squeeze re-anchors to where the arm actually is. The **index trigger** never moves the arm; it only drives the gripper (0–1).

---

## 3. Recording episodes

Recording is the **same** console — no separate step. Single keypress, no Enter:


| Key          | Action                                              |
| ------------ | --------------------------------------------------- |
| `r`          | Record on / off (a plain stop saves as **SUCCESS**) |
| `s`          | Save **SUCCESS** + stop                             |
| `f`          | Discard (**FAILURE**)                               |
| `h`          | Home both arms (teleop pauses)                      |
| `t`          | Set the task instruction for the next episode       |
| `l` · `i`    | List episodes · status                              |
| `q` / Ctrl-C | Stop teleop and quit                                |


Set the language instruction with `t` (or `--task "pick up the red block"` if launching the script directly). It is written to each episode as `instruction.txt`.

> **Saving freezes the control loop while it encodes video — hold still until you see `✓ ready`.**

The same keys apply in the windowed camera preview (press them in that window) and in a plain terminal console.

---

## 4. What gets saved

Each episode lands in a timestamped folder under `/opt/robot/recordings/hdf5/` on the host:

```
recordings/hdf5/2026-05-27_14-30-12/
├── trajectory.h5      # 14-dim state + action @ the teleop loop rate (--control-hz, default 150 Hz) + timestamps + frame_index
├── info.json          # arms / cameras / fps / resolution / codec + video frame counts
├── instruction.txt    # the task string
└── cameras/
    ├── left.mp4       # subsampled to ~30 fps, synced to trajectory.h5 frame_index
    ├── right.mp4
    └── side.mp4       # filenames come from --record-cameras
```

- **State/action** is `[left_j1..j6, left_gripper, right_j1..j6, right_gripper]` (14 values).
- These episodes are the **master copy** — replayed directly (`soda replay play <ep>`) and fed straight into training, no conversion step. Images are not replayed.
- If video encoding can't keep up, dropped frames are reported in `info.json`.

Managing, listing, and replaying episodes → **[Recordings](./recordings.md)**.

---

## 5. Tips

- **Pose diversity.** Vary object position, approach angle, and arm posture across episodes — a model only generalizes over what it has seen.
- **Don't fight the clutch.** If your hand drifts to an awkward reach, release, recenter your hand, and re-press. Re-anchoring is free and never jumps the arm — clutching harder does nothing.
- **One attempt = one episode.** Start with `r`, finish with `s` (success) or `f` (failure). Discard bad takes with `f` rather than saving noise.
- **Hold still on save.** The loop pauses to encode video; moving during `✓`-wait does nothing useful.
- **Move smoothly.** Small, deliberate motions track best; large snaps get clamped as implausible.

---

## Related

- [Recordings](./recordings.md) — episode layout, listing, replay
- [SODA CLI reference](./soda-cli-reference.md) — `soda teleop`, `soda replay`, all commands
- [Hand-eye calibration](shipped-docs.md) — calibrate cameras before collecting on real hardware

