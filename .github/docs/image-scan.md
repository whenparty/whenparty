# Image scans

[image-scan.yml](/.github/workflows/image-scan.yml) runs every Monday at 03:00 UTC and by hand. It scans with Trivy every image that the VPS runs, including the nginx proxy, Traefik and the TURN relay, which no deploy scans. It uploads critical and high findings to GitHub Security and fails on a critical one. A failure means that the image, or the base image in its `Dockerfile`, needs a newer version.

It reads images from the Compose files in the `List images` step; a Compose file at another path is not scanned until that list includes it. For an image that a deploy builds, the scan reads the `latest` tag that the Compose file names.

The deploys scan only the images they build:

| Workflow | Scan |
| --- | --- |
| `site.yml` | uploads findings to GitHub Security, and stops the deploy on a critical one |
| `deploy-project.yml` | prints findings in the log, and never fails the deploy |
| `infra.yml`, `traefik.yml` | none |
