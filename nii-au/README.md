# nii.au Site

The static site at `https://www.nii.au` (`nii.au` redirects to it). It deploys only to the nii.au domain. The When Party site lives in `../www/`.

The site is "little by little.", a one-page scroll journey: a 10-second illustrated video is scrubbed by the page scroll, with a static poster shown until the video is ready. It is an installable PWA and works offline after the first visit.

## Files

- `html/` - the site content (`index.html`, `styles.css`, `script.js`, `favicon.svg`)
- `html/media/` - the journey videos, their posters and the paper texture
- `html/sw.js`, `html/manifest.webmanifest`, `html/icons/` - the service worker, the web app manifest and the app icons
- `icons/` - SVG sources of the app icons
- `nginx.conf` - the container's server block: gzip, IPv6, cache headers and the manifest's MIME type
- `scripts/fingerprint.sh` - runs in the image build, gives media, CSS and JS content-hashed names and lists them in `sw.js`
- `scripts/encode-media.sh` - regenerates the videos and posters from the master video
- `scripts/make-icons.sh` - renders `html/icons/` from `icons/` (needs `rsvg-convert`, or Docker)
- `Dockerfile` - nginx image that serves `html/`
- `docker-compose.yml` - the `nii-au` container on the `wp_www` network (no published ports)

The public-facing nginx config for this site, including its Content-Security-Policy, is in `infra/nginx/conf.d/nii-au.conf`. It ships with the nginx deploy, not with this folder. Keep CSS and JS in their own files: the policy blocks inline `<style>` and `<script>`.

## Media

| File | What it is |
|---|---|
| `journey-desktop.av1.mp4`, `journey-desktop.mp4` | AV1 and H.264 1280x720, the full frame |
| `journey-mobile.av1.mp4`, `journey-mobile.mp4` | AV1 and H.264 576x720, a portrait slice of the frame for portrait phones |
| `poster-desktop.webp`, `poster-mobile.webp` | frame 0 of each video |
| `paper.png` | the tiled page background |

All videos have a keyframe every 12 frames (0.5 s) so scroll seeking stays cheap. The AV1 files are 25-35% smaller, but every seek decodes up to 11 frames, which software AV1 is too slow for on phones. So `script.js` picks AV1 only when `navigator.mediaCapabilities.decodingInfo()` reports it `supported` and `powerEfficient` (hardware decoding; on Apple devices that means iPhone 15 Pro and M3 Macs or newer) and H.264 everywhere else. It also falls back to H.264 if the AV1 file fails to download or decode. `script.js` downloads the whole video into a Blob before playing it, so seeks never wait on the network (that is why the CSP allows `media-src blob:`). Portrait phones (`max-width: 700px` and portrait) get the mobile files; that media query appears in `index.html`, `styles.css` and `script.js`, so change all three together.

To re-encode from the master video (needs `ffmpeg` with `libx264` and `libsvtav1`, and `cwebp`, e.g. `brew install ffmpeg webp`):

```bash
nii-au/scripts/encode-media.sh path/to/master.mp4
```

If you change the mobile crop in that script, update the crop constants in `script.js` too. If you change the AV1 settings, update the `codecs` level and `bitrate` that `script.js` passes to `decodingInfo()` (`ffprobe` shows both).

## Caching

The image build renames every file in `media/`, plus `styles.css` and `script.js`, to `name.<hash>.ext` and rewrites the references to them. Those files are served with `Cache-Control: public, max-age=31536000, immutable`. Everything else (`index.html`, `sw.js`, the manifest, the icons) is served with `no-cache`, so a deploy shows up on the next visit. Reference assets by their plain names (`/media/poster-desktop.webp`, `/styles.css`) in the source; the build fails if a file in `media/` is not referenced anywhere.

## Offline

`script.js` registers `sw.js` after the page loads. The build writes this build's hashed files into its `ASSETS` list, so every deploy that changes an asset changes `sw.js`, and browsers install the new worker on the next visit. The worker then drops files from earlier builds.

- The page itself is network-first: a fresh copy when the network answers within 3 s, the cached one otherwise.
- At install, the worker caches what the first screen needs: the page, CSS, JS, both posters, the texture, the favicon, the manifest and the 192 px icon. Most of these come straight from the HTTP cache.
- Videos are cached the first time the page loads one, so each device keeps only its own video (0.8-2.5 MB). When the page decoded a video before the worker took control of it, it sends the path with `postMessage` and the worker caches it then.
- Range requests (the plain `<video src>` fallback) always go to the network.

So a visitor gets the full scroll journey offline once one visit has loaded the video. On a slow connection the video only loads on scroll, so a visitor who left before scrolling sees the poster offline. Safari deletes the cache of a site that has not been opened for 7 days, unless it was added to the Home Screen.

To test offline locally, open the site at `http://localhost`, scroll once, stop the container and reload. The built-in browser pane of the Claude desktop app cannot register service workers, so use Chrome.

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
