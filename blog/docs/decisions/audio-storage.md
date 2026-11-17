# Audio storage

## Context

Most posts have an audio version of about 20 to 30 minutes. As MP3 at 64 kbit/s in mono, 25 minutes take about 12 MB, and a post links only to the newest version of its audio. Everything the sites serve runs on the WhenParty VPS.

[site.yml](/.github/workflows/site.yml) builds the image from the folder and copies only its `docker-compose.yml` to the VPS, as [deploys.md](/.github/docs/deploys.md#siteyml) says. Git LFS keeps files outside the repository, and every checkout of them counts towards a transfer quota of GitHub, as [screenshot-tests.md](/www/docs/decisions/screenshot-tests.md#context) notes. `nii-au/` keeps the master of its video in Git LFS and leaves it out of its image, as [media.md](/nii-au/docs/media.md) says.

The audio reaches listeners through [Cloudflare](/infra/docs/setup.md#cloudflare). Its [terms for the CDN](https://www.cloudflare.com/service-specific-terms-application-services/) on the Free, Pro and Business plans, as of September 2026, let it limit a zone that serves video, or a disproportionate share of audio files or other large files, without its paid services. On the Free plan its [cache](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/) keeps files up to 512 MB, and keeps `.mp3` by default but not `.m4a`.

## Options

- In Git LFS, copied into the image. Everything is in the repository, which is also the backup. The checkout in `site.yml`, which the deploys of `www/` and `nii-au/` also use, needs `lfs: true`. Every audio file adds to the image and to the LFS storage, and every deploy downloads all of them, which counts against the quota.
- In a folder on the VPS outside git and the image, which the container mounts read-only, with the content hash in each file name. The repository and the image stay small, and the deploy never touches the audio. The VPS holds the only copy on a server, so the originals need a backup elsewhere, and a new VPS needs the folder copied.
- In object storage, such as Cloudflare R2. Nothing on the VPS, and R2 charges no egress. It needs an account, a secret for uploads and another host, outside the VPS that runs everything else.

## Decision

A folder on the VPS, mounted read-only, with the hash in each file name. It keeps the repository, the image and every deploy free of audio files, keeps the audio on the VPS with the rest of the sites, and the hash lets the files be cached for a year, as [serving.md](/docs/conventions/serving.md) allows. If the blog's audio grows into a large share of the zone's traffic, the Cloudflare terms above are the reason to move it to object storage such as R2.

## Consequences

- [docker-compose.yml](../../docker-compose.yml) and [nginx.conf](../../nginx.conf).
- [posts.md](../posts.md), [site.md](../site.md) and [audio.md](../audio.md).
- `2-8` and `2-9` of [2-headers.md](/infra/docs/specs/2-headers.md).
