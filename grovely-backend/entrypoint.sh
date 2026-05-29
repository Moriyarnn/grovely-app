#!/bin/sh
# Drop from root to the user/group specified by PUID/PGID before starting Node.
# Defaults to 1000:1000 if not set. This ensures data volume files are owned
# by the host user, not root — a self-hosted convention (LinuxServer.io style).

PUID=${PUID:-1000}
PGID=${PGID:-1000}

# Create group and user if they don't already exist at the requested IDs
if ! getent group "$PGID" > /dev/null 2>&1; then
  addgroup -g "$PGID" appgroup
fi

if ! getent passwd "$PUID" > /dev/null 2>&1; then
  adduser -D -u "$PUID" -G "$(getent group "$PGID" | cut -d: -f1)" appuser
fi

# Ensure the data directory is owned by the target user
chown -R "$PUID:$PGID" /app/data 2>/dev/null || true

# Hand off to Node as the target user
if [ "$NODE_ENV" = "development" ]; then
  exec su-exec "$PUID:$PGID" npm run dev
else
  exec su-exec "$PUID:$PGID" node index.js
fi
