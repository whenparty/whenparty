# nii.au Site

The static site at `https://www.nii.au` (`nii.au` redirects to it). It deploys only to the nii.au domain. The When Party site lives in `../www/`.

The site is "little by little.", a one-page scroll journey: a 10-second illustrated video is scrubbed by the page scroll, with a static poster shown until the video is ready.

## Files

- `html/` - the site content (`index.html`, `styles.css`, `script.js`, `favicon.svg`)
- `html/media/` - the journey videos, their posters and the paper texture
- `nginx.conf` - the container's server block: gzip, IPv6 and cache headers
- `scripts/fingerprint.sh` - runs in the image build and gives media, CSS and JS content-hashed names
- `scripts/encode-media.sh` - regenerates the videos and posters from the master video
- `Dockerfile` - nginx image that serves `html/`
- `docker-compose.yml` - the `nii-au` container on the `wp_www` network (no published ports)

The public-facing nginx config for this site, including its Content-Security-Policy, is in `infra/nginx/conf.d/nii-au.conf`. It ships with the nginx deploy, not with this folder. Keep CSS and JS in their own files: the policy blocks inline `<style>` and `<script>`.

## Media

| File | What it is |
|---|---|
| `journey-desktop.mp4` | H.264 1280x720, the full frame |
| `journey-mobile.mp4` | H.264 576x720, a portrait slice of the frame for portrait phones |
| `poster-desktop.webp`, `poster-mobile.webp` | frame 0 of each video |
| `paper.png` | the tiled page background |

Both videos have a keyframe every 12 frames (0.5 s) so scroll seeking stays cheap. `script.js` downloads the whole video into a Blob before playing it, so seeks never wait on the network (that is why the CSP allows `media-src blob:`). Portrait phones (`max-width: 700px` and portrait) get the mobile files; that media query appears in `index.html`, `styles.css` and `script.js`, so change all three together.

To re-encode from the master video (needs `ffmpeg` and `cwebp`, e.g. `brew install ffmpeg webp`):

```bash
nii-au/scripts/encode-media.sh path/to/master.mp4
```

If you change the mobile crop in that script, update the crop constants in `script.js` too.

## Caching

The image build renames every file in `media/`, plus `styles.css` and `script.js`, to `name.<hash>.ext` and rewrites the references to them. Those files are served with `Cache-Control: public, max-age=31536000, immutable`; `index.html` and `favicon.svg` are served with `no-cache`, so a deploy shows up on the next visit. Reference assets by their plain names (`/media/poster-desktop.webp`, `/styles.css`) in the source; the build fails if a file in `media/` is not referenced anywhere.

## Deployment

A push to `main` that changes files under `nii-au/` (Markdown excluded) runs `.github/workflows/nii-au.yml`, which calls the shared `site.yml`:

1. builds the image and scans it with Trivy (critical findings stop the deploy)
2. pushes `ghcr.io/whenparty/nii-au:latest`
3. copies `docker-compose.yml` to `/opt/services/whenparty/nii-au` and runs `docker compose pull && docker compose up -d`

To update the site, edit `html/` and push.

## Local Testing

```bash
cd nii-au
docker build -t nii-au:local .
docker run --rm -p 3000:80 nii-au:local
```

Then open http://localhost:3000. The container does not send the Content-Security-Policy; the public nginx adds it.

## Troubleshooting

```bash
cd /opt/services/whenparty/nii-au
docker compose ps
docker compose logs
```

If the site returns 502, check that the `nii-au` container is running and attached to `wp_www` (`docker network inspect wp_www`).
