# Working on the site

- The nginx proxy sets the page's Content-Security-Policy in [www.conf](/infra/nginx/conf.d/www.conf), which ships with the nginx deploy, not with this folder. The policy blocks inline styles and scripts, so styles stay in `html/styles.css` and scripts in `.js` files in `html/`, such as `takeoff.js`. A new outside resource, such as another font host, needs a change to `www.conf`.
- To meet [serving.md](/docs/conventions/serving.md), `index.html` loads `styles.css` and each script with `?v=` and the first 8 hex digits that `shasum` prints for it. A change to one of them updates its `?v=` in the same commit.
- Browsers cannot animate a navigation to another origin, so on a click `takeoff.js` adds `is-flying` to the balloon and `is-leaving` to `body`, and opens the link after `takeoffMs`, a little before `takeoff` ends. In `styles.css` these classes start the `takeoff` animation and the fade, and on wide screens swap the balloon's sideways string for the hanging one. Change the two durations together. `styles.css` has no takeoff under reduced motion, so `takeoff.js` opens the link at once there.
- Every balloon's SVG has the same `viewBox`, and the string a balloon shows at rest ends at `--anchor` in `styles.css`, the point the balloon tilts, bobs and scales around: on the vertical rope on wide screens, and on the horizontal rope below 800px. The `top` and `left` of `.rope-vertical` and the `bottom` of `.rope-horizontal` repeat those anchors, so they change with `--anchor`. A new balloon copies the games balloon, so its strings, anchor and rope still meet.
- Through the proxy, every 404 of the site shows the shared 404 page, and `/_errors/` belongs to the proxy, as [nginx-configs.md](/infra/docs/nginx-configs.md) says. A 404 page of the site's own needs a change to `www.conf`.
- The container sends none of the proxy's headers, such as the Content-Security-Policy, so a local run does not show what they block. To run the site locally:

  ```bash
  cd www
  docker build -t www:local .
  docker run --rm -p 3001:80 www:local
  ```

  Then open http://localhost:3001.
- A push to `main` that changes files in `www/` other than Markdown runs [www.yml](/.github/workflows/www.yml), which deploys through [site.yml](/.github/workflows/site.yml). [deploys.md](/.github/docs/deploys.md) says which workflow changes also redeploy it.
