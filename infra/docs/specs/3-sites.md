# Sites

- `3-1` Each host on port 443 goes where this table says. A redirect keeps the path and query.

  | Host | Goes to |
  | --- | --- |
  | `when.party` | 301 to `https://www.when.party` |
  | `www.when.party` | the site of [`www/`](/www/AGENTS.md) |
  | `nii.au` | 301 to `https://www.nii.au` |
  | `www.nii.au` | the site of [`nii-au/`](/nii-au/AGENTS.md) |
  | `games.when.party` and `signaling.when.party` | the games, as [4-games.md](4-games.md) says |
  | any other host below `when.party` | the router of the temporary sites in [`temp-sites/`](/temp-sites/AGENTS.md), which picks the site by its host |

- `3-2` On `www.when.party`, `www.nii.au` and the hosts of the temporary sites, a 404 from the site shows the shared 404 page with status 404, which links to `/` of the same host. The page loads its styles from `/_errors/404.css` on the same host, which the proxy answers itself, without the site.
- `3-3` A 418 that comes through the router of the temporary sites, which the router itself sends for a host it does not know, answers 404 with the page for unknown hosts, which links to `https://www.when.party/`.
