#!/bin/sh
# Starts coturn with turnserver.conf, plus what only the running server knows: the TURN REST API
# secret (from TURN_SECRET, so it is neither in git nor in the process arguments), and the public
# address of a server that sits behind its provider's NAT.
set -eu

if [ -z "${TURN_SECRET:-}" ]; then
  echo 'turn: TURN_SECRET is not set. Add it to the repository secrets and deploy again.' >&2
  exit 1
fi

# The container uses the host's network, so these are the server's own addresses
own_ips=$(ip -o addr show scope global | awk '{print $4}' | cut -d/ -f1)
public_ip=$(detect-external-ip 2>/dev/null || true)

config=/tmp/turnserver.conf
umask 077
{
  cat /etc/coturn/turnserver.conf
  echo "static-auth-secret=$TURN_SECRET"

  # Behind NAT the public address is on no interface, and clients must be told that one
  if [ -n "$public_ip" ] && ! echo "$own_ips" | grep -qx "$public_ip"; then
    echo "external-ip=$public_ip"
  fi
} > "$config"

exec turnserver -c "$config"
