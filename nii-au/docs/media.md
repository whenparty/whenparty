# Journey media

`html/media/` holds the journey videos, their posters and the paper texture. `scripts/encode-media.sh` makes the videos and posters from the master video `media-source/journey.mp4`, which Git LFS stores: a checkout without `git lfs`, such as in CI, holds only a pointer file, so run `git lfs pull` before encoding. The Docker build leaves `media-source/` out through `.dockerignore`. The code expects a 1280x720 master at 24 fps with 241 frames. `brew install ffmpeg webp` installs the tools the script needs.

```bash
nii-au/scripts/encode-media.sh nii-au/media-source/journey.mp4
```

| Files | What they are |
|---|---|
| `journey-desktop.av1.mp4`, `journey-desktop.mp4` | AV1 and H.264, 1280x720, the full frame |
| `journey-mobile.av1.mp4`, `journey-mobile.mp4` | AV1 and H.264, 576x720, a portrait slice of the frame |
| `poster-desktop.webp`, `poster-mobile.webp` | frame 0 of each video |
| `paper.png` | the tiled page background |

## Which file a visitor gets

- Portrait phones get the mobile files, and other screens the desktop ones. The media query that decides this, `(max-width: 700px) and (orientation: portrait)`, appears in `index.html`, `styles.css` and `script.js`, written with and without spaces, and once negated in `index.html`. Change all of them together.
- `script.js` picks AV1 only when `navigator.mediaCapabilities.decodingInfo()` reports it `supported` and `powerEfficient`, that is, decoded in hardware. Everywhere else, and when the AV1 file fails to download or decode, it uses H.264. With reduced motion the page shows only the poster and loads no video.
- `script.js` downloads the whole video and plays it from a `blob:` URL, so seeks never wait on the network. When that download fails, it sets the H.264 file as the plain `src` of the video, which the browser then loads with range requests.

## What must change with the encoding

- When the mobile crop in `encode-media.sh` changes, update the crop constants in `script.js`. When the size of the slice changes, also update the size in `media.mobile` in `script.js` and the `width` and `height` of the mobile `<source>` in `index.html`.
- When the AV1 settings change, read each stream's new level and bitrate with `ffprobe` and update the `codecs` string and `bitrate` that `script.js` passes to `decodingInfo()`.
- The frame count and frame rate are `FRAMES` and `FPS` in `script.js`. A master with other values also changes the slider's `max`, which is `FRAMES - 1`, its `aria-valuetext` and the `00:10` label in `index.html`, and the seconds text in `script.js`.
- A new file in `media/` follows the rules in [caching.md](caching.md).
