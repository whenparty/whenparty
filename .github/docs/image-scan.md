# Image scans

[image-scan.yml](/.github/workflows/image-scan.yml) runs every Monday at 03:00 UTC and by hand. It scans with Trivy every image that the VPS runs. It uploads critical and high findings to GitHub Security and fails on a critical one. No deploy scans its image, as [scans-in-deploys.md](/docs/decisions/scans-in-deploys.md) decides. GitHub sends the notice of a failed run to the user who last changed the `cron` line of `image-scan.yml` or last enabled the workflow.

It reads images from the Compose files in the `List images` step; a Compose file at another path is not scanned until that list includes it. For an image that a deploy builds, the scan reads the `latest` tag that the Compose file names.

When a critical finding has a fixed version, the image, or the base image in its `Dockerfile`, needs a newer version.
