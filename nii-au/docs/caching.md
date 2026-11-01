# Caching and offline use

## Content-hashed names

- The image build runs `scripts/fingerprint.sh`, which gives every file in `media/`, `styles.css` and `script.js` a name with a hash of its content, rewrites the references to them and lists them in `sw.js`.
- In the source, reference these files by their plain path from the site root, such as `/media/poster-desktop.webp` or `/styles.css`. Media may be referenced only from `index.html`, `styles.css` and `script.js`, and `styles.css` and `script.js` only from `index.html`, because the script rewrites only those files. The build fails when nothing references a file in `media/`.
- `nginx.conf` serves hashed files as immutable for a year and everything else with `no-cache`, so a deploy shows on the next visit. It finds hashed files by a pattern that lists their extensions, `css`, `js`, `mp4`, `webp` and `png`. A media file with another extension gets a hashed name but `no-cache`, until the pattern lists it.
- The hash is 10 hex characters in `fingerprint.sh`, in the `nginx.conf` pattern and in `HASHED` in `sw.js`. Change the three together.

## Offline use

- `script.js` registers `sw.js` after the page loads. Each deploy that changes a hashed file changes `sw.js`, so browsers install the new worker on the next visit, and the worker drops the files of earlier builds.
- At install, the worker caches the files of the first screen: every hashed file except `.mp4` files, and the plain paths listed in `SHELL` in `sw.js`. So a large file or a video in another format in `media/` loads on every device, unless `SHELL` excludes it. When one of the plain paths is missing on the server, the install fails and the site does not work offline. Update `SHELL` when the favicon, the manifest or `icons/icon-192.png` is renamed.
- Page navigations and the plain paths in `SHELL` come from the network when the network answers within 3 seconds, and from the cache otherwise. Hashed files come from the cache first.
- A device caches only the video it loaded. The worker caches it when the page fetches it, and the page also reports it with `postMessage`, which covers a first visit that the worker did not control yet. Range requests always go to the network, so a video loaded through the plain `src` fallback is not kept.
- On slow connections and with Save-Data the page loads the video only on scroll, so a visitor who left before scrolling sees only the poster offline. Safari deletes the cache of a site that has not been opened for 7 days, unless it was added to the Home Screen.
- To test offline use, run the site locally as [site.md](site.md) shows, scroll once, stop the container and reload. Use Chrome: the browser pane of the Claude desktop app cannot register service workers.
