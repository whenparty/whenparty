# Separate host

## Context

The blog is a section of When Party, and the page of `www.when.party` is to link to it with a balloon of its own, as it links to the games. Its posts are Markdown, so its pages need a build step, and a new post comes every week or two.

`www/` is one page written by hand, without a build step or package dependencies for the page. Its browser tests compare storyboards of the balloon takeoff with approved screenshots, as [screenshot-tests.md](/www/docs/decisions/screenshot-tests.md) decides, and `www.yml` deploys it on every change in `www/` other than Markdown.

The proxy sets a Content-Security-Policy per host. The policy of `www.when.party` already lets the blog's pages load what they need, their audio included, through `default-src 'self'`. The certificate `when.party.crt` covers `*.when.party`, as [setup.md](/infra/docs/setup.md#certificates) says, and a proxied wildcard DNS record sends every host one level below `when.party` to the VPS, as the [Cloudflare section](/infra/docs/setup.md#cloudflare) of setup.md says. nginx picks a server with an exact `server_name` before the wildcard server of `temp-sites.conf`, as [nginx-configs.md](/infra/docs/nginx-configs.md) says. [site.yml](/.github/workflows/site.yml) builds and deploys a folder that has a `Dockerfile` and a `docker-compose.yml`.

## Options

- Pages under a path of `www.when.party`, such as `/blog/`, built in `www/`. No new host, project, container or deploy workflow, and the proxy needs no change. `www/` gets a build step and a package dependency, every post redeploys the main page, and the documents of the main page and of the blog share one project.
- A temporary site in `temp-sites/projects/`, on `blog.when.party` behind the Traefik router. It needs no proxy config and no deploy workflow of its own. Temporary sites are meant to go away, they share one policy that allows `'unsafe-inline'`, and every deploy of the router interrupts them for a few seconds, as [traefik.md](/temp-sites/docs/traefik.md) says.
- A project of its own, `blog/`, on `blog.when.party`, in a container of its own on the `wp_www` network, with a config of its own in `infra/nginx/conf.d/`. It costs a project with its documents, a deploy workflow and a proxy config, and needs no new certificate or DNS record.

## Decision

A project of its own on `blog.when.party`. The main page stays one page written by hand, whose deploy and tests do not change with posts, and the blog gets a build, a deploy and a policy that can change apart from those of the main page. Unlike a temporary site, it is not meant to go away, has a policy without `'unsafe-inline'` and is not interrupted by deploys of the router.

## Consequences

- [AGENTS.md](../../AGENTS.md) and [site.md](../site.md).
- [blog.conf](/infra/nginx/conf.d/blog.conf), [2-2](/infra/docs/specs/2-headers.md), [3-1](/infra/docs/specs/3-sites.md) and [3-2](/infra/docs/specs/3-sites.md).
- [blog.yml](/.github/workflows/blog.yml).
