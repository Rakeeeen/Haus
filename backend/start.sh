#!/bin/bash
# Starts the Haus bot. launchd runs this (~/Library/LaunchAgents/com.haus.bot.plist) and keeps it alive;
# restart it with `launchctl kickstart -k gui/$(id -u)/com.haus.bot` — running this file by hand would start a second copy.
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR" || exit 1
export PATH="$HOME/.nvm/versions/node/v24.21.0/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
exec node bot.js
