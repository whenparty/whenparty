# www

`www/` is the [project](/docs/glossary.md#project) of the When Party site at `www.when.party`: a static page that an nginx container serves behind the nginx proxy in `infra/`. It is one [deployment](/docs/glossary.md#deployment).

- [docs/site.md](docs/site.md): the Content-Security-Policy that limits the page, how `index.html` versions the URLs of its styles and scripts, how the balloon takeoff and the balloons' strings and ropes fit together, how to run it locally and how it deploys. Read it before changing `html/`, the `Dockerfile` or `docker-compose.yml`.
- [docs/tests.md](docs/tests.md): what the browser tests check, how to run them, and how the approved screenshots of the takeoff are updated. Read it before changing `html/`, `tests/`, `package.json`, `playwright.config.ts` or [www-snapshots.yml](/.github/workflows/www-snapshots.yml).
- [docs/decisions/screenshot-tests.md](docs/decisions/screenshot-tests.md): why the takeoff is checked with storyboard screenshots in git that a labelled workflow in CI makes, and why the deploy does not wait for the tests.
- [/infra/docs/sites.md](/infra/docs/sites.md): how the nginx proxy reaches the site by its container name and the `wp_www` network, what must change on both sides when either changes, and what a 502 means.
