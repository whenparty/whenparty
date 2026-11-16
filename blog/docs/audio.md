# Audio files on the VPS

The audio files lie in `/opt/services/whenparty/blog/audio/` on the VPS, which the container reads, as [site.md](site.md) says. Neither the repository nor the image holds a copy of them, so keep the originals elsewhere.

## The upload user

Files reach the folder through the user `blogaudio`, which logs in only with a key and only to SFTP, as [audio-upload.md](decisions/audio-upload.md) decides. It cannot run commands or reach Docker. Over SFTP it can write to the audio folder, its home and `/tmp`, and read the files of the VPS that every user may read.

Each device that uploads gets a key of its own. On a device that already has keys, give it a name of its own, `ssh-keygen -t ed25519 -f ~/.ssh/blogaudio -C "<device>"`, and add `-i ~/.ssh/blogaudio` to `scp` and `sftp`. Its `.pub` file goes into `authorized_keys`.

Run these as root, before or after the first deploy of the blog: `chown blogaudio:` also fixes an `audio/` folder that Docker created for root at its first start. `<deploy user>` is the user in the secret `VPS_USER` of [github-setup.md](/.github/docs/github-setup.md), the owner of the other sites' folders, because the deploy copies `docker-compose.yml` into `blog/`.

```bash
useradd -m -s /usr/sbin/nologin blogaudio
mkdir -p /opt/services/whenparty/blog/audio
chown <deploy user>: /opt/services/whenparty/blog
chown blogaudio: /opt/services/whenparty/blog/audio
chmod 755 /opt/services/whenparty/blog/audio
install -d -m 700 -o blogaudio -g blogaudio /home/blogaudio/.ssh
echo '<public key of the device>' >> /home/blogaudio/.ssh/authorized_keys
chown blogaudio: /home/blogaudio/.ssh/authorized_keys
chmod 600 /home/blogaudio/.ssh/authorized_keys
cat > /etc/ssh/sshd_config.d/blogaudio.conf <<'EOF'
Match User blogaudio
    ForceCommand internal-sftp -d /opt/services/whenparty/blog/audio -u 022
    DisableForwarding yes
    PermitTTY no
Match all
EOF
sshd -t && systemctl reload ssh
```

- `/etc/ssh/sshd_config` must include `/etc/ssh/sshd_config.d/*.conf`, as it does by default on Debian 12 and Ubuntu 22.04 and later. On some systems the service is `sshd`, not `ssh`. When the config lists users in `AllowUsers` or groups in `AllowGroups`, add `blogaudio` there.
- `Match all` ends the block for `blogaudio`, so that the lines that follow the include in `/etc/ssh/sshd_config` still apply to every user.
- A reload of SSH keeps the open sessions. Keep the current one open until both a new SSH login of your own and `sftp blogaudio@<VPS>` work, and fix the config from it if they fail.
- On a new VPS, copy the files back as `blogaudio`, for example with `sftp` and `put *.mp3`, so that it owns them and can remove them.

## Uploading

Name the file and upload it when [posts.md](posts.md) says, then:

```bash
chmod 644 influence-without-authority.3f9a1c2e.mp3
scp influence-without-authority.3f9a1c2e.mp3 blogaudio@<VPS>:/opt/services/whenparty/blog/audio/
```

The upload keeps the file's mode on the device, and nginx in the container needs it readable by everyone, which `chmod 644` makes sure of. `-u 022` only keeps uploads from being writable by others. `scp` needs OpenSSH 9.0 or later, which sends it over SFTP; with an older client, use `sftp blogaudio@<VPS>` and `put`. `blogaudio` cannot open a shell, so `ssh blogaudio@<VPS>` only starts SFTP. To remove an old version of a file, connect with `sftp` and use `rm`.
