# Scans in deploys

## Context

The VPS runs images that the [deploys](/.github/docs/deploys.md) build: the sites through `site.yml`, and the games and temporary sites through `deploy-project.yml`. It also runs images that no workflow builds: nginx, Traefik and coturn. The weekly [image-scan.yml](/.github/workflows/image-scan.yml) scans all of them with Trivy, fails on a critical finding and uploads findings to GitHub Security, as [image-scan.md](/.github/docs/image-scan.md) says. So it helps only when someone acts on them.

New vulnerabilities are published for images that already run. The weekly scans of 2026-11-02 and 2026-11-09 failed both times on a critical one in the `brotli-libs` package of Alpine, in images built before it was published, and coturn still runs the tag they flagged. Every critical finding so far came from a package of a base image, which a newer tag of that image fixes, as `nginx:1.31.8-alpine` did. A finding that no version fixes yet is also in the image that runs, so stopping a deploy does not remove it.

A scan took 5 to 7 seconds in `deploy-project.yml`, and the scan, upload and second scan of `site.yml` about 25 seconds.

## Options

- Scans in the deploys only, each stopping its deploy on a critical finding. No image with a known critical vulnerability is pushed. Images that no workflow builds, and images that are not built again, are never scanned after their deploy. An urgent fix waits until a fixed base image exists.
- The previous decision: the weekly scan, and scans in the deploys. `site.yml` stopped its deploy on a critical finding, and `deploy-project.yml` printed the findings and went on. A critical vulnerability that a change brings in, such as a new dependency, stops the deploy of a site. Deploys take longer, the two deploys treat findings differently, and an urgent fix of a site waits until a fixed base image exists.
- The weekly scan, and scans in the deploys that stop a deploy only on a critical finding that a newer version fixes. A critical vulnerability that a change brings in stops its deploy. Deploys take longer, and an urgent fix waits for a newer base image tag whenever one fixes a finding.
- The weekly scan only. Deploys are faster and a scan never stops one. An image with a critical vulnerability can run for up to a week before the scan fails.

## Decision

Only the weekly scan checks the images. The weekly scan, which the last three options share, sees every image the VPS runs and the vulnerabilities published after a deploy; scans in the deploys add only an earlier failure for the images that a deploy builds. The critical findings so far needed a newer base image tag, which is a change of its own, so a scan that stops a deploy only makes that change come earlier, when an urgent fix is waiting. Up to a week with a known vulnerability costs less than up to 25 seconds on every deploy and a fix held back by a base image.

## Consequences

- [image-scan.yml](/.github/workflows/image-scan.yml) and [image-scan.md](/.github/docs/image-scan.md).
- [site.yml](/.github/workflows/site.yml) and [deploy-project.yml](/.github/workflows/deploy-project.yml), which do not scan, and the permissions that their callers grant, as [workflows.md](/.github/docs/workflows.md#permissions-of-reusable-workflows) says.
