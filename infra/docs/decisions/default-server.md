# Default server on port 443

## Context

nginx gives a TLS connection whose SNI names no server, or that has no SNI, to the default server of the port. That is the server whose `listen` has `default_server`, or else the first server with that `listen` in the order nginx loads the configs. The image loads `conf.d/*.conf` in alphabetical order. The server sends its certificate during the handshake, before `ssl_verify_client` checks Cloudflare's client certificate, so a client without that certificate still sees it.

Through Cloudflare, such a connection comes only for a proxied host in `nii.au` other than `nii.au` and `www.nii.au`, because the wildcard in `temp-sites.conf` gives every `*.when.party` host a server. Without Cloudflare, it comes from anyone who connects to the server's address, such as a scanner. The deploy never deletes a file on the VPS, so a config that a revert removes from the repository stays there, as [deploys.md](/.github/docs/deploys.md#infrayml) says.

## Options

- The previous setup: no `default_server`, so the first server in alphabetical order, `www.nii.au` in `nii-au.conf`. Nothing to write. A new config earlier in the alphabet, such as `games.conf`, silently becomes the default, and with it its certificate and its site.
- `default_server` on `www.nii.au`. Every host gets what it got in the previous setup, and file names no longer matter. A host in `nii.au` that no config names gets the `nii.au` site, and a client without SNI sees the `nii.au` certificate.
- A server of its own with `default_server` and `ssl_reject_handshake on`, in `default.conf`. A client gets no certificate unless its SNI names a server, so a scanner does not learn the domains, and the `default_server` flag, not the file names, decides. A proxied host that no config names gets Cloudflare's error 525 instead of a page. `default.conf` already holds the settings shared by every site and the port 80 server.
- The same server in a file of its own. `default.conf` stays as it is. The servers that take the connections no config names, on ports 80 and 443, are in two files, and after a revert the file stays on the VPS.

## Decision

A server of its own with `ssl_reject_handshake on`, in `default.conf`. A connection that names no server gets no certificate and no site, and that does not depend on file names. Error 525 shows only for a host that no config serves. It sits in `default.conf` next to the port 80 server, so one file holds what applies to every site, and a revert removes it with the rest of the change.

## Consequences

- [default.conf](../../nginx/conf.d/default.conf).
- [The default server in nginx-configs.md](../nginx-configs.md#the-default-server).
