# www

`www/` is the [project](/docs/glossary.md#project) of the When Party site at `www.when.party`: a static page that an nginx container serves behind the nginx proxy in [`infra/`](/infra/AGENTS.md). It is one [deployment](/docs/glossary.md#deployment).

- [docs/site.md](docs/site.md): the Content-Security-Policy that limits the page, how `index.html` versions the URLs of its styles and scripts, how the balloon takeoff and the balloons' strings, anchors and ropes fit together, how to add a balloon, how to run it locally and how it deploys. Read it before changing `html/`, the `Dockerfile` or `docker-compose.yml`.
- [docs/tests.md](docs/tests.md): what the browser tests check, how to run them, and how the approved screenshots of the takeoff are updated. Read it before changing `html/`, `tests/`, `package.json`, `playwright.config.ts` or [check-www.yml](/.github/workflows/check-www.yml).
- [docs/decisions/balloon-sharpness.md](docs/decisions/balloon-sharpness.md): why the `refilter` animation runs with every inflate, after Back too, and ends 1 s after the inflate, so that Safari draws the balloons sharp, why `inflate`, `refilter` and `bob` share `--inflate` and `--inflate-delay`, and why the balloons bob by animating `rotate`.
- [docs/decisions/screenshot-tests.md](docs/decisions/screenshot-tests.md): why the takeoff is checked with storyboard screenshots in git, and why the deploy does not wait for the tests.
- [docs/decisions/screenshot-updates.md](docs/decisions/screenshot-updates.md): why [check-www.yml](/.github/workflows/check-www.yml) makes the new screenshots and an agent commits them.
- [/infra/docs/sites.md](/infra/docs/sites.md): how the nginx proxy reaches the site by its container name and the `wp_www` network, what must change on both sides when either changes, and what a 502 means.
