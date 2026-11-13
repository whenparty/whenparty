# Verification

Each test `tests/<n>-<topic>.smoke.sh` checks the requirements of `docs/specs/<n>-<topic>.md`. [check-nginx.yml](/.github/workflows/check-nginx.yml) runs them after `nginx -t`, as [checks.md](/.github/docs/checks.md#the-checks) says, and [proxy-tests.md](decisions/proxy-tests.md) explains why the deploy waits for them. [nginx-configs.md](nginx-configs.md#checking-a-change) says how to run `nginx -t` alone.

To run them locally, with Docker running and `curl` and `openssl` installed, from the repository root:

```bash
for test in infra/tests/*.smoke.sh; do sh "$test"; done
```

Run one test at a time: each one removes the containers that the others start. A test prints one line per check, `ok` or `not ok`, that starts with the ID of the requirement, and exits with an error when a check fails. All four take a little over a minute.

- [tests/proxy.sh](../tests/proxy.sh), which every test sources, runs nginx from the image in `docker-compose.yml` with a copy of `nginx/conf.d/` without `cloudflare_real_ip.conf`. It creates its own certificates for `when.party` and `nii.au`, and a certificate authority that stands in for Cloudflare's, so the test's requests carry a client certificate. It reaches the proxy on `127.0.0.1:18443` and `127.0.0.1:18080`, so those ports must be free.
- The sites are stubs from the same image, on a network of their own, `proxy-test`. They carry the names that the configs use, such as `www`, `index` or `traefik-tempsites`, and answer with the host, path and headers they got. So a test stops when a container with the name of a stub exists that it did not start, such as on the VPS. It removes only the containers that carry its label, `whenparty.proxy-test`, also when it fails or is interrupted.
- After it stops a stub, `4-games.smoke.sh` restarts nginx, which forgets the stub's address at once instead of after the `valid` time of its resolver.
- `2-headers.smoke.sh` holds requests in progress with slow downloads, so it takes about half a minute. Its checks of the rate accept a range of answers, because a runner takes time to send a burst.
- For `2-5`, the test checks that the configs set 90 seconds and nothing else, then sets 1 second in its copy and checks the behaviour against a stub that pauses as its path says. The stub is a shell script behind BusyBox `nc` in the same image, and the test opens its WebSockets with `openssl s_client`. nginx moves a running timer only when the new deadline differs by 300 ms or more, so a timeout much shorter than 1 second would close a request that keeps sending.
- For `2-7`, the test checks that the configs set 2 seconds and nothing else, then stops a stub and points its upstream in the copy at the stub's former address, which nobody answers, with the timeout at 1 second. With the name, nginx would answer 502 once it asks Docker's DNS again, up to 5 seconds later, so the copy names the address.
- A request through the proxy uses HTTP/2 unless the test asks for `--http1.1`, which a WebSocket upgrade needs.
