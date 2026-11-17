# blog

`blog/` is the [project](/docs/glossary.md#project) of the When Party blog at `blog.when.party`: Markdown posts that Eleventy builds into static pages, which an nginx container serves behind the nginx proxy in [`infra/`](/infra/AGENTS.md). It is one [deployment](/docs/glossary.md#deployment).

- [docs/posts.md](docs/posts.md): how to write a post: its folder and address, its front matter, images and the `#side` mark, formulas, drafts and audio. Read it before adding or changing a post or `src/posts/posts.11tydata.js`.
- [docs/site.md](docs/site.md): what `eleventy.config.js` adds to Markdown, how styles, images and audio get URLs that change with their content, the cache headers of `nginx.conf`, how the container mounts the audio folder and the limits it runs with, which page the look follows, the Content-Security-Policy, how to run the site locally and how it deploys. Read it before changing `eleventy.config.js`, `package.json`, `package-lock.json`, `.dockerignore`, `src/_includes/`, `src/index.njk`, `src/styles.css`, `nginx.conf`, the `Dockerfile` or `docker-compose.yml`.
- [docs/audio.md](docs/audio.md): the audio folder on the VPS, the SFTP-only user `blogaudio` and how to set it up, and how to upload audio. Read it before uploading audio, setting up a VPS for the blog or changing the mount of `audio/` in `docker-compose.yml`.
- [docs/decisions/separate-host.md](docs/decisions/separate-host.md): why the blog is a project of its own on `blog.when.party` and not pages of `www/`.
- [docs/decisions/site-generator.md](docs/decisions/site-generator.md): why Eleventy builds the pages.
- [docs/decisions/formulas.md](docs/decisions/formulas.md): why KaTeX turns formulas into MathML at build time.
- [docs/decisions/audio-storage.md](docs/decisions/audio-storage.md): why the audio files live in a folder on the VPS, outside git and the image.
- [docs/decisions/audio-upload.md](docs/decisions/audio-upload.md): why an SFTP-only user without a chroot uploads them.
- [/infra/docs/sites.md](/infra/docs/sites.md): how the nginx proxy reaches the site by its container name and the `wp_www` network. Read it before renaming the service, the container or the network in `docker-compose.yml`.
