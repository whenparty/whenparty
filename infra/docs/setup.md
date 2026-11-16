# Setup outside the repository

The proxy relies on this setup on the VPS and in Cloudflare. The GitHub secrets that the deploy uses, and what the deploy user needs, are in [github-setup.md](/.github/docs/github-setup.md).

## VPS

The certificates folder must exist before the first deploy:

```bash
mkdir -p /opt/services/whenparty/infra/nginx/certs
```

`infra.yml` creates the `wp_www`, `wp_tempsites` and `wp_games` networks. The site deploys through `site.yml` do not create `wp_www`, so on a new VPS the proxy deploys before `www/`, `blog/` and `nii-au/`.

## Certificates

The certificates are Cloudflare Origin Certificates, valid for 15 years, created in the Cloudflare dashboard under SSL/TLS → Origin Server. Git ignores `*.crt` and `*.key` files, so they exist only on the VPS.

| Files in `/opt/services/whenparty/infra/nginx/certs/` | Host names |
| --- | --- |
| `nii.au.crt`, `nii.au.key` | `nii.au`, `*.nii.au` |
| `when.party.crt`, `when.party.key` | `when.party`, `*.when.party` |

```bash
chmod 644 /opt/services/whenparty/infra/nginx/certs/*.crt
chmod 600 /opt/services/whenparty/infra/nginx/certs/*.key
```

See [Cloudflare Origin Certificates](https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/).

## Cloudflare

Each zone served here, `nii.au` and `when.party`, has these settings:

- SSL/TLS mode is Full (strict).
- Always Use HTTPS is on.
- Authenticated Origin Pulls is on, under SSL/TLS → Origin Server. Without it, nginx rejects Cloudflare's requests and every site in the zone answers 400. nginx checks Cloudflare's client certificate against `nginx/conf.d/cloudflare-origin-pull-ca.pem`, which is valid until 2029-11-01.
- The DNS records of the sites point to the VPS and are proxied. In `when.party`, a proxied wildcard record `*.when.party` covers every host one level below it that has no record of its own. `turn.when.party` is not proxied, as the [TURN relay's documentation](/games/platform/turn/AGENTS.md) says.
- Browser Cache TTL is at Cloudflare's default of 4 hours. So a static file, such as a stylesheet, that its site sends without `Cache-Control` reaches browsers with `max-age=14400`, while a file's own `no-cache` and a longer `max-age` reach them as the site sends them.
