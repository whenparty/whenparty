# Deploying temp sites

[temp-sites.yml](/.github/workflows/temp-sites.yml) deploys the sites in `projects/` through `deploy-project.yml`, which [deploys.md](/.github/docs/deploys.md#deploy-projectyml) describes. The router in `traefik/` has its own deploy, which [traefik.md](traefik.md#deploy) describes.

## What a push deploys

- A push to `main` deploys each site whose folder has a changed file other than Markdown. A change to Markdown only, or to files in `temp-sites/` outside `projects/`, deploys no site. So a site that serves Markdown files redeploys only when another of its files changes.
- To redeploy a site without a failed run to re-run, push a change to a file in its folder other than Markdown. The workflow cannot be run by hand.
- Each site deploys in its own job, so one failed site does not stop the others.
- The deploy copies the site's folder to `/opt/services/whenparty/temp-sites/projects/<name>`. A file removed from the folder stays there until someone deletes it on the VPS. Files put there by hand, such as `.env`, stay too.

## The first deploy

When the new package of a site with a `Dockerfile` is private, its first deploy fails at the pull until the user makes the package public and re-runs the failed jobs, as [github-setup.md](/.github/docs/github-setup.md#container-packages) says.

## Retrying a failed deploy

Open the failed run in GitHub Actions and re-run its failed jobs. They deploy the same commit again. Re-run only when no later run has deployed that site, because a re-run of an older run puts the older files and image back.

## Removing a site

When a push deletes a site's folder, the deploy takes the site down and deletes its folder on the VPS, with any secrets and data in it. A renamed folder counts as a removed site and a new one, with a new package and, by convention, a new host. The GHCR package and the DNS record stay. The user deletes them by hand if the name will not be used again.
