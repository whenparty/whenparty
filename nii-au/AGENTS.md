# nii-au

`nii-au/` is the [project](/docs/glossary.md#project) of the site at `www.nii.au`: a one-page scroll journey that an nginx container serves behind the nginx proxy in `infra/`. It is one [deployment](/docs/glossary.md#deployment).

- [docs/site.md](docs/site.md): the Content-Security-Policy that limits the page code, the menu breakpoint, the app icons, how to run the site locally and how it deploys. Read it before changing `html/`, `icons/`, `scripts/make-icons.sh`, the `Dockerfile` or `docker-compose.yml`.
- [docs/media.md](docs/media.md): the journey videos and posters, and what in `html/` must change with them. Read it before running or changing `scripts/encode-media.sh`, or changing the portrait media query, the mobile crop, the codec settings or the frame count of the video.
- [docs/caching.md](docs/caching.md): content-hashed names, cache headers and offline use. Read it before adding, renaming or removing a file in `html/`, or changing `nginx.conf`, `scripts/fingerprint.sh` or `html/sw.js`.
- [/infra/docs/sites.md](/infra/docs/sites.md): how the nginx proxy reaches this site's container. Read it before renaming the service, the container or the network in `docker-compose.yml`.
