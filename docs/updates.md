# Software Updates

> Purpose: what to expect from automatic robot updates, and the few recovery commands an operator may ever need. Audience: on-site operators / customer admins.

**Day-to-day: nothing to do.** The robot updates itself, silently and safely, over the internet. It never interrupts a job and rolls itself back if an update misbehaves.

## How updates work

A systemd timer (`robot-ota.timer`) runs the updater in the background — first ~2 minutes after boot, then every 30 minutes (with jitter; missed ticks catch up).

Each tick:

1. Checks the release channel (`stable`) for a newer version. If none, it exits and waits for the next tick.
2. **Waits for the robot to be idle.** It never swaps versions during teleop, a policy run, or calibration — doing so mid-motion would make the arms drift. If the robot stays busy, the update simply defers to a later tick (waits up to 30 min per tick).
3. Downloads only the changed pieces, switches to the new version, and runs a health check.
4. **If the health check fails, it automatically rolls back** to the last known-good version — using the copy already on the robot, so this works even with no internet.

Intermittent network is fine: a failed or interrupted download just retries next tick. The
outbound endpoints the updater needs are listed in
[network-requirements.md](network-requirements.md).

## Commands you may occasionally use

All except `soda version` require `sudo`.

| Task | Command |
|---|---|
| Check versions (CLI + backend) | `soda version` |
| Update now (don't wait for the timer) | `sudo /opt/robot/ota/update.sh` |
| Roll back to the previous version | `sudo /opt/robot/ota/rollback.sh` |
| List versions available on the robot | `sudo /opt/robot/ota/rollback.sh --list` |
| Pause automatic updates | `sudo systemctl disable --now robot-ota.timer` |
| Resume automatic updates | `sudo systemctl enable --now robot-ota.timer` |

`update.sh` and `rollback.sh` both wait for the robot to be idle before switching versions, exactly like the automatic path.

> **Note:** In an emergency where the backend is unresponsive and you have confirmed the arms are in a mechanically safe pose, `sudo /opt/robot/ota/rollback.sh --force` skips the idle wait. Use it only in that situation.

## Where history and logs live

Update state lives under `/var/lib/robot-ota/`:

| File | Contents |
|---|---|
| `current` | Version running now |
| `previous` | Default target for a rollback |
| `history.log` | Rolling record of every update and rollback |

Live logs:

```bash
sudo journalctl -t robot-ota -e          # updater output (updates + auto-rollbacks)
sudo journalctl -u robot-ota.timer -e    # when the timer fired
```

## What survives an update

Everything under `/opt/robot/**` is stored on the robot itself and is **never touched** by an update — your **config, calibration, policies, and recordings** all carry over unchanged. Updates only replace the application software.

---

- Something went wrong? See [troubleshooting](troubleshooting.md).
- Vendor / release-engineering side (channels, publishing, fleet-wide rollback): [../developer/vendor/release-workflow.md](shipped-docs.md).