# Smoke test

[smoke.sh](../tests/smoke.sh) runs coturn and coturn's test client `turnutils_uclient` in the image that [compose.yml](../compose.yml) names.

- coturn runs on an internal Docker network of its own, so nothing leaves the host and `start.sh` finds no public address. The network's addresses, `11.11.11.0/24`, lie outside every range that `turnserver.conf` denies, so two relayed clients may reach each other.
- `start.sh` looks up the public address before coturn starts, and on this network the lookup fails only after its timeouts, about 15 seconds. So the test tries STUN up to 30 times, with a pause of one second after each failed try, before its checks.
- The client exits with 255 when coturn refuses it, which some checks expect, so the checks read only its output.
- The check of two relayed clients sends 20 messages, because with fewer the client keeps waiting after the last one.
- Every run of `turnutils_uclient` ends after 60 seconds at the latest, so a client that keeps waiting cannot hang the test. The image's `timeout` is BusyBox's: it replaces itself with the client, so the client keeps its process, and a child process of `timeout` sends the signal. Without `--init` the client would be the container's PID 1, which ignores that signal, so the client runs with Docker's `--init`.
