#!/usr/bin/env bash
# Watchdog: start the Next.js dev server if it isn't already running.
# Used so the Preview panel always has a server on :3000.
# IMPORTANT: we explicitly set DATABASE_URL to the MongoDB Atlas value because
# the shell may carry a stale SQLite DATABASE_URL that Next.js would prefer over
# the .env file (Next.js does not override existing process.env values).
cd /home/z/my-project

# Export the MongoDB connection (matches .env).
export DATABASE_URL="mongodb+srv://as4777481_db_user:mongodb@webbasedlabsmonitoring.eamb1yx.mongodb.net/SyntheticDataPlatform?retryWrites=true&w=majority&appName=WebBasedLabsMonitoring"

if pgrep -f "next-server\|next dev" >/dev/null 2>&1; then
  echo "$(date): already running"
  exit 0
fi
# Not running — start it detached, logging to dev.log.
pkill -9 -f "next dev" 2>/dev/null
sleep 1
setsid bash -c 'bun run dev >> /home/z/my-project/dev.log 2>&1' < /dev/null &
disown
echo "$(date): (re)started dev server (MongoDB)"
