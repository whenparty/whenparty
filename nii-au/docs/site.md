# Working on the site

- The nginx proxy sets the site's Content-Security-Policy in [nii-au.conf](/infra/nginx/conf.d/nii-au.conf), which ships with the nginx deploy, not with this folder. The policy blocks inline styles and scripts, including `style` attributes, so styles stay in `html/styles.css` and scripts in `html/script.js`. Styles that `script.js` sets through `element.style` still work. Images may come only from the site itself, so a `data:` image is blocked too. Media may also come from `blob:` URLs, which the journey video needs, as [media.md](media.md) says. A new outside resource, such as a font host, needs a change to `nii-au.conf`.
- Through the proxy, every 404 of the site shows the shared 404 page, and `/_errors/` belongs to the proxy, as [nginx-configs.md](/infra/docs/nginx-configs.md) says. A 404 page of the site's own needs a change to `nii-au.conf`.
- Up to 870px, `styles.css` shows the menu button and hides the navigation links in `@media (max-width: 870px)`. `script.js` closes an open menu when the window grows past that, at `(min-width: 871px)`. Change the two together.
- `scripts/make-icons.sh` renders the app icons in `html/icons/` from the SVG sources in `icons/`. Commit the rendered PNGs. [caching.md](caching.md) says which icon the service worker needs.
- The container sends none of the proxy's headers, such as the Content-Security-Policy, so a local run does not show what they block. To run the site locally:

  ```bash
  cd nii-au
  docker build -t nii-au:local .
  docker run --rm -p 3000:80 nii-au:local
  ```

  Then open http://localhost:3000.
- A push to `main` that changes files in `nii-au/` other than Markdown runs [nii-au.yml](/.github/workflows/nii-au.yml), which deploys through [site.yml](/.github/workflows/site.yml). [deploys.md](/.github/docs/deploys.md) says which workflow changes also redeploy it.
- On the VPS the site runs in `/opt/services/whenparty/nii-au`, where `docker compose ps` and `docker compose logs` show its state.
