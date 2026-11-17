# Audio upload

## Context

The audio files lie in a folder on the VPS outside git and the image, as [audio-storage.md](audio-storage.md) decides, so someone uploads them by hand from a device. The deploy user, whose key is in the secret `VPS_DEPLOY_KEY`, runs `docker` over SSH, as [github-setup.md](/.github/docs/github-setup.md#secrets) says, and Docker's documentation states that this grants root-level privileges. OpenSSH can tie a user to SFTP with `ForceCommand internal-sftp`, and `ChrootDirectory` can also lock it into a folder, which must then be owned by root, as must every folder above it. The [deploy](/.github/docs/deploys.md#siteyml) copies `docker-compose.yml` into `/opt/services/whenparty/blog/` as the deploy user, so that folder is the deploy user's.

## Options

- Upload with the deploy user, or with root. Nothing to set up. A device that uploads then holds a key that amounts to root on the VPS, and a leak of it exposes the whole VPS.
- A user `blogaudio` that logs in only with a key and only to SFTP, without a chroot. A few commands as root. A leaked key lets someone write to the audio folder, the user's home and `/tmp`, and read what every user of the VPS may read, but not run commands or reach Docker.
- The same user in a chroot. The key reaches only the audio files. The audio folder has to move out of `blog/`, for example to a root-owned `/opt/services/whenparty/blog-audio/` with a folder inside it for `blogaudio`, and `docker-compose.yml` has to mount that absolute path.

## Decision

The SFTP-only user without a chroot. Against the deploy user or root, a device that uploads holds a key that cannot run commands or reach Docker. Against the chroot, it keeps the audio folder beside `docker-compose.yml` and needs no folder owned by root in the deploy's path. What it can still read is what every user of the VPS may read anyway.

## Consequences

- [audio.md](../audio.md) and [audio.sh](../../scripts/audio.sh).
