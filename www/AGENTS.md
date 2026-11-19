# www

`www/` is the [project](/docs/glossary.md#project) of the When Party site at `www.when.party`: a static page that an nginx container serves behind the nginx proxy in [`infra/`](/infra/AGENTS.md). It is one [deployment](/docs/glossary.md#deployment).

- [docs/site.md](docs/site.md): the Content-Security-Policy that limits the page, how the page versions the URLs of its styles, scripts and font, which font file it serves, how the balloon takeoff and the balloons' strings, anchors and ropes fit together, how to add a balloon, how to run it locally and how it deploys. Read it before changing `html/`, the `Dockerfile` or `docker-compose.yml`.
- [docs/tests.md](docs/tests.md): what the browser tests check, how to run them, and how the approved screenshots of the takeoff are updated. Read it before changing `html/`, `tests/`, `package.json`, `playwright.config.ts` or [check-www.yml](/.github/workflows/check-www.yml).
- [docs/decisions/balloon-sharpness.md](docs/decisions/balloon-sharpness.md): why the `refilter` animation runs with every inflate, after Back too, and ends 1 s after the inflate, so that Safari draws the balloons sharp, why `inflate`, `refilter` and `bob` share `--inflate` and `--inflate-delay`, and why the balloons bob by animating `rotate`.
- [docs/decisions/endless-bob.md](docs/decisions/endless-bob.md): why the balloons bob without end, with no stop after 5 seconds and no pause control, though WCAG 2.2.2 asks for one of them. Read it before changing how long the balloons move.
- [docs/decisions/font-hosting.md](docs/decisions/font-hosting.md): why the page serves Golos Text from its own files and not from Google Fonts, why `index.html` preloads it, why it serves only the `latin` subset, and why the file is the one Google serves to Chrome on Windows and Linux.
- [docs/decisions/screenshot-tests.md](docs/decisions/screenshot-tests.md): why the takeoff is checked with storyboard screenshots in git, and why the deploy does not wait for the tests.
- [docs/decisions/screenshot-updates.md](docs/decisions/screenshot-updates.md): why [check-www.yml](/.github/workflows/check-www.yml) makes the new screenshots and an agent commits them.
- [/infra/docs/sites.md](/infra/docs/sites.md): how the nginx proxy reaches the site by its container name and the `wp_www` network, what must change on both sides when either changes, and what a 502 means.
