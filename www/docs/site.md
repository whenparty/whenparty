# Working on the site

- The nginx proxy sets the page's Content-Security-Policy in [www.conf](/infra/nginx/conf.d/www.conf), which ships with the nginx deploy, not with this folder. The policy blocks inline styles and scripts, so styles stay in `html/styles.css`. A new outside resource, such as another font host, needs a change to `www.conf`.
- The container sends none of the proxy's headers, such as the Content-Security-Policy, so a local run does not show what they block. To run the site locally:

  ```bash
  cd www
  docker build -t www:local .
  docker run --rm -p 3001:80 www:local
  ```

  Then open http://localhost:3001.
- A push to `main` that changes files in `www/` other than Markdown runs [www.yml](/.github/workflows/www.yml), which deploys through [site.yml](/.github/workflows/site.yml). [deploys.md](/.github/docs/deploys.md) says which workflow changes also redeploy it.
