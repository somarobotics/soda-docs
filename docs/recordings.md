# Where Do My Recordings Go?

!!! abstract "Purpose / Audience:"
    For operators — where SODA writes recordings and how to make each.


Almost everything you record — hand-driven demos **and** policy rollouts — lands in **one place: `/opt/robot/recordings/hdf5/`** on the host, in the same replayable episode format. Running a policy and recording it (with DAgger takeovers) is **one integrated flow**, not two separate destinations. A low-level debug capture (`/opt/robot/output/policy_runs/`) also exists, but it's off by default and is *not* what `--record` produces.

## Training episodes → `recordings/hdf5/<YYYY-MM-DD_HH-MM-SS>/`

The episodes you collect and train on. Same `trajectory.h5` + `cameras/*.mp4` + `info.json` + `instruction.txt` schema whether the motion came from your hands or a policy, and all replayable with `soda replay play`.


| Source                                       | Command                                                                                | What it captures                                                                                                                              |
| -------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Teleop demo**                              | Quest teleop **`r`** to start/stop, or the collect console (`r` rec · `s` save · `f` discard) | your hand-driven demonstration                                                                                                                |
| **Policy rollout** | `soda run <policy> --record` (60 Hz) | the **executed (measured)** trajectory of the whole rollout PLUS two per-step command streams: `action/policy` (the policy's post-safety-terminal would-be command, computed every tick) and `action/human` (NaN-filled unless taken over). Timestamps continuous, nothing excised -- schema 2.1 |
| **DAgger rollout** | `soda run <policy> --dagger` (implies record, 150 Hz — teleop's step cadence) | the **whole rollout, policy-driven steps included** — one episode, same format and destination as a teleop demo: `action/<arm>` is the **command in force** (the policy's while it drives, yours while you do — exactly a hand demo's action semantics), the measured trajectory is in `observation/*`. Who was driving is a **per-step label, not a file boundary**: `action/controller_info/intervening` (plus per-arm `clutch_left`/`clutch_right`) is `true` exactly on the taken-over steps, and both command streams are always present (`action/policy` every step; `action/human` non-NaN per arm while a human drives it). `info.json` and the HDF5 attrs carry `dagger: true`. Schema 2.1 |


`soda run --record` starts the policy **and** the episode recorder together (it calls the same `/api/record/start` as `soda record`), so the rollout — plus any correction you make by taking over — is saved as a **single** `recordings/hdf5/` episode. Policy and DAgger are the same recording path; there is no separate "policy" destination.

!!! note "Training on DAgger episodes:"
    a `--dagger` episode contains policy-driven steps too. When building a correction dataset, select the takeover spans by masking on `action/controller_info/intervening` (per arm: the steps where `action/human/<arm>/joint_position` is non-NaN). Accidental grabs of a few steps are no longer dropped at record time — filter short spans at dataset build time instead. The surrounding policy-driven context (especially the steps just before a grab) stays available, which is exactly the transition data span-only recording used to throw away. Full mechanism, controls and extraction code: [dagger.md](dagger.md).


!!! note "Camera budget for long rollouts:"
    the recorder buffers raw camera frames in RAM until save (same as teleop). At 3 × 720p cameras @ 15 fps this covers roughly **3 minutes** of video per episode; past that, camera frames freeze (one warning on the backend console) while joints, actions and the intervening flags keep recording to the end. Keep DAgger sessions inside that window, or split long runs into several `soda record start`/`stop` sessions.


## Model debug telemetry → `output/policy_runs/<policy_id>/<name>/`  · advanced, off by default

A separate, low-level capture of exactly what the **model** saw and output: `policy_view.mp4` (the composited model-view), `tracking.csv` (per-step target joints), `probe.json` (run metadata). Use it to debug *why* a policy behaved as it did.

!!! note "Note:"
    this is **not** produced by `soda run --record`. It only turns on when a policy entry (or a `/policy/start` override) sets `record: true`. It is debug telemetry — **not** a training episode and **not** replayable.


## Raw topic streams · telemetry

`soda stream --sub <topics> --record` dumps raw high-rate PUB topic streams (e.g. `left/joint_states`) for latency/analysis — not episodes.

!!! warning
    `soda replay play` streams a saved **joint** trajectory back to the arms (⚠ moves the arms); images are not replayed. Add `--record` to a replay to save the playthrough as a new `recordings/hdf5/` episode.


## These survive updates

`recordings/` and `output/` are host bind-mounts under `/opt/robot`, outside the container — **untouched by OTA updates and rollbacks**. Your demos and telemetry persist across every upgrade.

## See also

- [Running your policy](./running-your-policy.md) · [Data collection (teleop)](./data-collection-teleop.md) · [soda CLI reference](./soda-cli-reference.md)

