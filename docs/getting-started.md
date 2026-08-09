# SODA Tabletop Dual-Arm — Getting Started

The whole robot ships as **one Docker image** that auto-starts on boot. In normal use you drive everything from the browser (`:8079`) or the `soda` CLI and never touch Docker directly. This page covers install, daily operation, the container commands for the rare times you need them, updates, and where your data lives.

!!! warning "Safety"
    The software STOP kills the robot stack; arm torque is cut by the firmware watchdog within about half a second and the arms sag under gravity — it is not a mechanical brake. The only guaranteed emergency stop is cutting arm power at the AC plug. Full details: [safety.md](safety.md).


---

## Install (first boot)

**Canonical first-install path.** After Ubuntu 20.04 / 22.04 boots and you have internet, run **one command**:

```bash
curl -fsSL https://somarobotics.github.io/soda-ota-channels/bootstrap.sh | bash
```

That's it. The bootstrap handles:

- Installing Docker (if missing)
- Adding your user to the `docker` group (with no log-out required)
- Pulling the current stable image
- Handing off to `install.sh`, which walks you through license, network, OTA, and real-time setup interactively — and writes `/opt/robot/docker-compose.yml`, the systemd units, and the `soda` CLI

The whole flow is idempotent — re-run the same command any time and it skips finished steps.

!!! note "Note:"
    `docker compose -f /opt/robot/docker-compose.yml up -d` is **not** the first-install path. The bootstrap installer is what provisions the compose file, systemd timers, OTA, and RT isolation. The compose `up -d` (below) is only a container-lifecycle command you use *after* a manual `down` — it will not set a unit up from scratch.


**Architecture**: this image is multi-arch (linux/amd64 + linux/arm64). x86_64 and Jetson / ARM customer machines both work out of the box — `docker pull` auto-selects the right one. M-series Macs are not supported as customer machines (no native Linux GPU access).

If anything fails, run the built-in diagnostic:
`docker exec -it robot-backend-1 python -m soda_os.tools.doctor`.

### Inspect-first (if you'd rather not `curl | bash`)

```bash
curl -fsSL https://somarobotics.github.io/soda-ota-channels/bootstrap.sh -o /tmp/bootstrap.sh
less /tmp/bootstrap.sh        # review what it does
bash /tmp/bootstrap.sh
```

### Manual fallback (advanced users only)

If your environment blocks `curl | bash` outright, or you want full control:

```bash
# (only needed if `docker ps` shows "permission denied")
sudo usermod -aG docker $USER
# Then reboot or fully log out of your desktop session before continuing.
# Opening a new terminal does NOT refresh group membership.

VERSION=$(curl -fsSL https://somarobotics.github.io/soda-ota-channels/stable.txt)
docker pull ghcr.io/somarobotics/soda-app:$VERSION
docker cp "$(docker create ghcr.io/somarobotics/soda-app:$VERSION)":/opt/app/compose-overlay/install.sh /tmp/install.sh
bash /tmp/install.sh
```

---

## Day-to-day operation

The container is configured with `restart: unless-stopped`, so it **auto-starts on every boot**. Open the browser, click **Launch**. No commands needed.

### Normal use (UI-only)


| Task                          | How                                                                 |
| ----------------------------- | ------------------------------------------------------------------- |
| Open UI                       | Browser → `http://<this-machine>:8079`                              |
| Start arms (real)             | UI → `Launch (real)`                                                |
| Start arms (sim, no hardware) | UI → `Launch (sim)`                                                 |
| Stop arms                     | UI → `Stop` (container keeps running; click Launch again to resume) |
| Software E-stop               | UI → `[STOP]`                                                       |
| **Hard E-stop**               | **Pull controller's AC plug.**                                      |


### Command-line control


| Task                              | Command                                                                                                                          |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| List everything it can do         | `soda help`                                                                                                                      |
| Stack up                          | `soda up real` (or `sim`)                                                                                                        |
| Stop everything (software e-stop) | `soda stop` — kills every stack process (`soda estop` is a byte-identical alias)                                                 |
| Status                            | `soda status`                                                                                                                    |
| Run a policy                      | `soda run <id> "your prompt"` — stop **just the policy** with `q` / Ctrl-C in the run console; `soda stop` kills the whole stack |
| Home / gripper                    | `soda home` · `soda gripper open\|close [left\|right\|both]`                                                                     |
| Loop rate + jitter (acceptance)   | `soda smi --rate` — see **Self-monitoring** below                                                                                |
| System + RT health panel          | `soda smi` (`-l 1` to refresh)                                                                                                   |
| Command→motion latency            | `soda smi --cmd-to-motion` (moves a joint) — see **Self-monitoring** below                                                       |


`soda smi` and friends need Python + ZMQ; on a bare host they auto-run inside the container, so there's nothing to set up. Full command reference: [soda-cli-reference.md](soda-cli-reference.md).

### Self-monitoring: control rate, jitter, latency

Every SODA ships with the tools to verify its real-time control loop **on your own hardware** — you don't have to take vendor spec numbers on faith. Four numbers describe control-loop health, and each has **one** command that reports it:


| Number                     | What it means                                                                             | Command                    |
| -------------------------- | ----------------------------------------------------------------------------------------- | -------------------------- |
| **Loop rate**              | how many times per second each arm's control/state loop runs (target 500 Hz)              | `soda smi --rate`          |
| **Jitter**                 | cycle-to-cycle spread of that loop — `dt` p50 / p95 / p99 / max, in ms (lower = steadier) | `soda smi --rate`          |
| **Sensor→host latency**    | age of a state sample when it reaches the host (`s->h`, ms)                               | `soda smi --rate`          |
| **Command→motion latency** | time from issuing a joint command to the arm actually moving                              | `soda smi --cmd-to-motion` |


### Real-time core isolation (control-loop rate)

The arm control loop must run at `SCHED_FIFO` on a **kernel-isolated CPU core** to hold 500 Hz. Two pieces make this work, and the installer sets up both:

- **Container capability** — the compose file grants the container an `rtprio` ulimit (so `SCHED_FIFO` is allowed) and `SYS_NICE` (for camera/arm CPU pinning). This ships in the image; nothing to do.
- **Host core isolation** — the cores the loops pin to must be isolated from the normal scheduler (`isolcpus`), a **kernel boot setting + one reboot**. `install.sh` detects this and offers to enable it; you can also do it later:
  ```
  sudo bash /opt/robot/tools/rt_setup.sh --isolate-only   # edits GRUB (backs it up first)
  sudo reboot                                             # required to take effect
  cat /sys/devices/system/cpu/isolated                    # expect e.g. 6-7
  ```

Verify it after boot with `**soda smi**` (no flags): each arm's control loop should show it pinned to an isolated core at `SCHED_FIFO`, and `soda smi --rate` should sit at ~499–500 Hz per arm (acceptance floor: ≥ 485 Hz sustained, both arms). If `soda smi` shows the loop on a shared core at normal priority, isolation is not active — re-run the step above and reboot. On multi-camera cells the launcher also pins the RealSense servers off the arm cores automatically (log line `[launcher] CPU partition: ...`).

!!! note "Operational rule"
    run the browser UI on a **separate laptop** and keep the NUC headless. Loading the host with a local browser is the most common cause of control-loop jitter.


---

## The container (Docker)

You almost never touch Docker — the container auto-starts on boot and OTA manages upgrades. This section is for the rare times you do: a full teardown, restart, or logs.

!!! note "Two different "stops.""
    Stopping the **container** (Docker `down`) tears down everything, launcher included. Stopping the **stack** (UI `Stop` / `soda stop`) kills every stack process but the launcher and container keep running, so you can Launch again in seconds. Day to day you want the stack-level stop, not the container.


Everything lives in `/opt/robot`. These commands assume the compose file there.


| Task                                                 | Command                                                           |
| ---------------------------------------------------- | ----------------------------------------------------------------- |
| Start container (after a `down`)                     | `docker compose -f /opt/robot/docker-compose.yml up -d`           |
| Status                                               | `docker compose -f /opt/robot/docker-compose.yml ps`              |
| Restart (after editing `site.yaml` / `license.json`) | `docker compose -f /opt/robot/docker-compose.yml restart`         |
| Full teardown (stop + remove container)              | `docker compose -f /opt/robot/docker-compose.yml down`            |
| Live logs                                            | `docker compose -f /opt/robot/docker-compose.yml logs -f backend` |
| Enter container shell                                | `docker exec -it robot-backend-1 bash`                            |
| Run diagnostics                                      | `docker exec -it robot-backend-1 python -m soda_os.tools.doctor`  |


Because the container is `restart: unless-stopped`, it comes back on every reboot by itself — you only run `up -d` the first time after a manual `down`. Once it's up, open `http://<this-machine>:8079` and click **Launch**.

---

## Updates + rollback

The unit updates itself: OTA checks every 30 min, waits for the robot to be idle, restarts the container (~5–10 s UI dropout), and **auto-rolls-back** if the new image doesn't come up healthy. **You never need to restart anything by hand after an update.**


| Task                            | Command                                                         |
| ------------------------------- | --------------------------------------------------------------- |
| Current version                 | `soda version` (CLI + backend versions; warns on mismatch)      |
| Current image tag               | `docker inspect robot-backend-1 --format '{{.Config.Image}}'`   |
| Force OTA check now             | `sudo /opt/robot/ota/update.sh`                                 |
| Roll back one version           | `sudo /opt/robot/ota/rollback.sh`                               |
| Roll back to a specific version | `sudo /opt/robot/ota/rollback.sh --list`                        |
| Update history                  | `cat /var/lib/robot-ota/history.log`                            |
| Pause / resume auto-updates     | `sudo systemctl disable --now robot-ota.timer` / `enable --now` |


Full detail on the update / rollback flow: [updates.md](updates.md).

---

## Where everything lives

All operator data lives in `/opt/robot/` on the host. Container restarts and OTA upgrades **never** touch it — configuration, calibration, and data all carry across updates.


| Path                            | What                                                                                                                                                                                                                                                                                     | Edit?                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `/opt/robot/config/site.yaml`   | Hardware config: arm IP, camera serials, gripper limits, arm spacing                                                                                                                                                                                                                     | **Yes** — see [Changing hardware config](#changing-hardware-config) below |
| `/opt/robot/license.json`       | Vendor-signed license, tied to this machine's fingerprint                                                                                                                                                                                                                                | **No** — vendor reissues if needed                                        |
| `/opt/robot/calibration/`       | Hand-eye calibration results (4×4 matrices)                                                                                                                                                                                                                                              | No — produced by calibration tool                                         |
| `/opt/robot/policies/`          | Policy registry — one YAML per policy in `/opt/robot/policies/policies/<id>.yaml`: host/port + gripper/image config of your policy servers. Re-read on every request, so adding or editing a policy needs no restart. Model checkpoints run on your **own GPU policy server**, not here. | Via the UI "Add policy" dialog                                            |
| `/opt/robot/deploy/`            | Your client code + `user_hooks.py`                                                                                                                                                                                                                                                       | Yes — your integration code                                               |
| `/opt/robot/recordings/`        | Teleop / demo recordings                                                                                                                                                                                                                                                                 | Yes — for backup or transfer                                              |
| `/opt/robot/logs/`              | Application logs                                                                                                                                                                                                                                                                         | Read-only in practice                                                     |
| `/opt/robot/.env`               | Image version + registry                                                                                                                                                                                                                                                                 | **No** — OTA manages this                                                 |
| `/opt/robot/docker-compose.yml` | Container orchestration                                                                                                                                                                                                                                                                  | **No** — OTA manages this                                                 |
| `/opt/robot/install-ota.sh`     | OTA installer (only used at first install)                                                                                                                                                                                                                                               | No                                                                        |
| `/opt/robot/ota/`               | OTA update + rollback scripts                                                                                                                                                                                                                                                            | No — replaced on OTA upgrades                                             |


### Changing hardware config

If you swap a camera, change the arm controller's IP, or move the arms to a new bench spacing, re-run the site wizard from inside the container:

```bash
docker exec -it robot-backend-1 python -m soda_os.tools.site init       # interactive wizard
docker exec -it robot-backend-1 python -m soda_os.tools.site validate   # schema + ping + serial check
docker compose -f /opt/robot/docker-compose.yml restart                 # pick up the new config
```

For minor tweaks (e.g. a single port number), edit `/opt/robot/config/site.yaml` directly, then run `validate` + `restart`.

If you swap any camera, you must **also re-calibrate** the affected camera — the calibration matrix in `/opt/robot/calibration/` is bound to the camera's serial number. See the [hand-eye calibration guide](shipped-docs.md).

### Re-issuing the license

If the host's hardware changes (motherboard swap, NIC swap, OS reinstall on a different disk), the fingerprint changes and the existing license stops working. Email the new fingerprint to your vendor:

```bash
docker run --rm --network host -v /etc/machine-id:/etc/machine-id:ro \
  ghcr.io/somarobotics/soda-app:$(cat /opt/robot/.env | grep ROBOT_VERSION | cut -d= -f2) \
  python main.py --print-fingerprint
```

When the new `license.json` arrives:

```bash
sudo cp <path-to-new-license.json> /opt/robot/license.json
docker compose -f /opt/robot/docker-compose.yml restart
```

---

## Related docs


| Doc                                                                      | When to read                                                             |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| [safety](safety.md)                                                      | What the software STOP does and does not guarantee, e-stop behavior      |
| [soda CLI reference](soda-cli-reference.md)                              | Full `soda` command list and flags                                       |
| [software updates](updates.md)                                           | The update / rollback flow in detail                                     |
| [hand-eye calibration](shipped-docs.md)             | Hand-eye calibration walkthrough                                         |


