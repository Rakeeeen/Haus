#!/bin/bash
# Starts the Haus bot — always exactly one copy. launchd runs this at login (~/Library/LaunchAgents/com.haus.bot.plist)
# and keeps it alive; you can also run it by hand: it first closes any copy already running (this one's own earlier
# run, a hand-started one, anything holding the webhook port), then starts a fresh one.
# Restart with `bash start.sh` or `launchctl kickstart -k gui/$(id -u)/com.haus.bot`.
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR" || exit 1
export PATH="$HOME/.nvm/versions/node/v24.21.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

PORT="${WEBHOOK_PORT:-3001}"

# Every running `node bot.js` except this script's own process tree, then whatever still listens on the port.
running() {
  { pgrep -f "^node bot.js$"; lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null; } | sort -u | grep -v -x "$$"
}

old="$(running)"
if [ -n "$old" ]; then
  echo "🔁 Closing the copy that is already running ($(echo $old | tr '\n' ' '))"
  kill $old 2>/dev/null
  for _ in $(seq 1 20); do   # up to 10 s to exit on its own
    [ -z "$(running)" ] && break
    sleep 0.5
  done
  left="$(running)"
  [ -n "$left" ] && { echo "⚠️  Still alive, forcing it closed"; kill -9 $left 2>/dev/null; sleep 1; }
fi

exec node bot.js
