# Cloudflare IP list

`default.conf` takes the client's address from the `CF-Connecting-IP` header, but only for requests from the addresses that `set_real_ip_from` lines list. Those lines live in `nginx/conf.d/cloudflare_real_ip.conf`, which exists only on the VPS and which git ignores. Without it, nginx sees Cloudflare's address as the client's, so the rate limits count every visitor behind one Cloudflare address as one client.

`scripts/update-cloudflare-real-ip.sh` downloads Cloudflare's IPv4 and IPv6 ranges and writes the file. When the list differs from the file on disk, it runs `nginx -t` and reloads nginx if nginx is running. When the list is the same, it changes nothing. When a download fails, it exits with an error and leaves the file as it was.

Every deploy runs the script once when the file is missing or has no `set_real_ip_from` line, as [deploys.md](/.github/docs/deploys.md#infrayml) says. It also installs a line in the deploy user's crontab that runs the script every hour and writes its output to `/tmp/update-cloudflare-real-ip.log`. It replaces any line that names the script's current path and keeps all other lines. So after the script is renamed or moved, the line with the old path stays in the crontab until someone removes it on the VPS.

To check the job on the VPS, run `crontab -l` as the deploy user.
