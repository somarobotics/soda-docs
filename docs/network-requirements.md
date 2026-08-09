# Network Requirements

!!! abstract "Purpose / Audience"
    what the unit talks to on the internet and the LAN, for the IT/network
    team provisioning the site. Canonical port reference:
    [integration/ports-and-planes.md](shipped-docs.md).


---

## Outbound (internet)

| Domain | Purpose | When |
|--------|---------|------|
| `somarobotics.github.io` | OTA channel file (`soda-ota-channels/<channel>.txt`, default `stable.txt`) | every 30 min; first check ~2 min after boot |
| `ghcr.io` | Image pulls (`ghcr.io/somarobotics/soda-app`) | install + when OTA finds a new version |
| `*.githubusercontent.com` | GitHub's CDN — image-pull traffic transits it | during pulls |
| `get.docker.com`, `download.docker.com` | Docker install | first install only, if Docker is absent |

Everything else — health checks, e-stop, ZMQ device traffic — is localhost or LAN only.

---

## LAN ports (inbound to the robot host)

| Port | Service | Who connects |
|------|---------|--------------|
| `8079` | Launcher (lifecycle, e-stop, OTA gate) + Web UI | operator laptop browser; `soda` CLI |
| `8080` | Backend API + WebSocket | Web UI; `soda` CLI; your supervisory scripts |

ZMQ device sockets (arms, cameras) are **loopback-only** (`127.0.0.1`) — they are never exposed
to the LAN. A Plane-2 real-time client runs on the robot host itself.

---

## Serving your policy

The robot **dials out** (`ws://`) to your GPU server's `host:port` — you do not open any inbound
port on the robot for policy serving. Your GPU host must be reachable *from* the robot (same LAN
or routed network). Wire contract:
[integration/policy-io-contract.md](shipped-docs.md).

---

## Running offline

A unit runs fine with no internet: only the OTA check (and the first install) need outbound
access. Offline, the robot simply keeps running its current version. See
[updates.md](updates.md).
