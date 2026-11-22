# Deploy checks

## Context

`games.yml` checks `games/`, builds and starts the images of the [deployments](/docs/glossary.md#deployment) a push reaches and runs the end-to-end tests on them before it deploys them, as [games-check-scope.md](/docs/decisions/games-check-scope.md) and [browser-tests.md](/games/docs/decisions/browser-tests.md) decide. Then `deploy-project.yml` starts the new containers on the VPS. A title whose `base` differs from its container name, or whose build lacks a file, starts and passes its health check, which asks only for `/`, while its page answers 404 through the proxy, as [hosting.md](/games/titles/docs/hosting.md) says.

- Players reach the games through Cloudflare and nginx. nginx accepts only requests that carry Cloudflare's client certificate (`1-2` of [1-connections.md](/infra/docs/specs/1-connections.md)), so a request from the VPS or the runner that skips Cloudflare does not reach the sites through nginx.
- Cloudflare keeps the files of the titles, so a request for a file that the VPS no longer has can still answer 200. A query that Cloudflare has not seen passes the request to the VPS.
- After a deploy gives a container a new address, nginx can send requests to the old one for 5 seconds, as [sites.md](/infra/docs/sites.md) says.
- The rooms server of production keeps at most 10 open rooms for all players (`12-1` of [12-server-answers.md](/games/platform/rooms/docs/specs/12-server-answers.md)), and a room whose owner's page did not leave stays open for minutes (`10-3` of [10-server-room.md](/games/platform/rooms/docs/specs/10-server-room.md)).
- Each deploy of signaling ends every room, as [room-storage.md](/games/platform/docs/decisions/room-storage.md) decides. A page and the transport server must name the same protocol versions (`7-1` of [7-server.md](/games/platform/transport/docs/specs/7-server.md)).
- `deploy-project.yml` tags each image with its commit and does not record which image ran before.

## Options

What the deploy checks after it starts the containers:

- Nothing more. A container that does not start or stays unhealthy, and a page that answers 404, go unnoticed until a player reports them.
- Only that the containers run and pass their health checks. It catches a container that does not start, not a page or file that answers 404 or 502 through the proxy.
- The containers' health, then the live site over public HTTPS from the runner: the pages and files of the deployed titles and the index page with the proxy's headers, and signaling's `/health` and a WebSocket upgrade. It checks what players reach, Cloudflare and nginx included, needs no secrets, and depends on Cloudflare passing the runner's requests and on a query that gets past its cache.
- The same checks from the VPS. They skip Cloudflare's cache, but need Cloudflare's client certificate to pass nginx, or skip nginx, and run with the SSH key.

How far the check goes on the live site:

- Pages, files, headers and the WebSocket upgrade, without a room. It cannot see a game that loads and breaks in play.
- Open a room and play in a browser. It sees more, takes one of the 10 rooms from players while it runs, keeps it for minutes when it fails before it leaves, and needs a browser on the runner.

What a failed check does:

- Roll back to the image that ran before. Players get the last working version sooner. The deploy has to find that image, which nothing records; a rollback of signaling ends every room again; a rollback of one deployment can leave pages and signaling with different protocol versions; and a failure outside the images, such as in Cloudflare or nginx, stays.
- Fail the run and leave the new version live. Players see the broken version until a fix or a revert reaches `main`.

Which deploys wait for their containers' health:

- Only those of `games.yml`. A temporary site's deploy passes while its container does not start.
- Every deploy of `deploy-project.yml`. A temporary site whose container does not start fails its deploy too, and each deploy waits for its first health check, up to 30 seconds today.

## Decision

Every deploy of `deploy-project.yml` waits for its containers' health, because a container that does not start is a failed deploy for a temporary site as for a game. Then `games.yml` checks the live site over public HTTPS from the runner, with a query that gets past Cloudflare's cache and attempts over 30 seconds that outlast nginx's 5 seconds. Only a check through Cloudflare and nginx sees what players see, and it needs neither a secret nor a client certificate.

The check opens no room, because the 10 rooms of production belong to players. A game that breaks in play is for the browser tests that run before the deploy, in `check-games.yml` and on the images in `games.yml`, where no player's room is at stake.

A failed check fails the run and rolls nothing back. A rollback needs a record of the previous images, ends the rooms again, can split the protocol versions of pages and signaling, and does not fix a failure outside the images.

## Consequences

- [deploys.md](/.github/docs/deploys.md#deploy-projectyml) says how a deploy waits for its containers, and [deploys.md](/.github/docs/deploys.md#gamesyml) what the check of `games.yml` covers.
- [smoke-games.py](/.github/scripts/smoke-games.py) runs the check, from the `smoke` job of [games.yml](/.github/workflows/games.yml).
