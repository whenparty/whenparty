# Proxy tests

## Context

The [specification](../specs/) of `infra/` describes what the proxy does for visitors, for Cloudflare and for the sites behind it, and the [testing rules](/docs/conventions/tests.md) want a test for every requirement, through the public interface. The proxy's interface is HTTP on ports 80 and 443, so its tests run nginx from the image of `docker-compose.yml` in Docker, with stubs in place of the sites, and take a little over a minute, as [verification.md](../verification.md) says. A config that breaks the proxy breaks every site at once. Changes to `infra/` are rare next to those of the sites.

[check-nginx.yml](/.github/workflows/check-nginx.yml) runs `nginx -t`. `ci.yml` calls it for every change to `infra/`, and `infra.yml` calls it before every deploy, which waits for it. A deploy does not wait for `ci.yml`, as [ci-checks.md](/docs/decisions/ci-checks.md) decides. GitHub's runners have Docker. The smoke test of the [index page](/games/index/docs/verification.md) runs only by hand.

## Options

- By hand only, like the smoke test of the index page. No time in CI. A change that breaks a requirement deploys unless someone ran the tests.
- A check of its own that only `ci.yml` calls. A pull request shows the result, and a deploy does not wait for it. A direct push with broken routing deploys before the check fails.
- A step of `check-nginx.yml` after `nginx -t`. A pull request shows the result, and broken routing never deploys. Every deploy of `infra/` waits a little over a minute longer, and a test that fails by chance stops it.

## Decision

A step of `check-nginx.yml`. A broken proxy takes every site down, and `infra/` deploys rarely, so a minute before each deploy costs less. A test that fails by chance is retried by running the workflow again.

## Consequences

- [check-nginx.yml](/.github/workflows/check-nginx.yml).
- [verification.md](../verification.md) and [checks.md](/.github/docs/checks.md#the-checks).
