# TURN

`turn/` is the [deployment](/docs/glossary.md#deployment) of coturn at `turn.when.party`, which relays WebRTC traffic when direct connections fail. It is part of the [transport module](../transport/AGENTS.md), whose specification says which credentials it accepts (`8-2` of [8-turn.md](../transport/docs/specs/8-turn.md)).

- [docs/deployment.md](docs/deployment.md): the files of the deployment, and the secret, DNS, firewalls, container restrictions, denied peer addresses and quotas that the deployment needs. Read it before changing the configuration, the container or how the VPS is set up for TURN.
- [docs/verification.md](docs/verification.md): which tests check the configuration, startup and image, and when to run them.
- [docs/smoke-test.md](docs/smoke-test.md): how `smoke.sh` runs coturn and its client. Read it before changing `smoke.sh`.
- [turn-credentials-limit.md](../docs/decisions/turn-credentials-limit.md): why the quotas, and no limit on credentials, bound the use of TURN.
