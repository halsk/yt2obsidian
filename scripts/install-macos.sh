#!/usr/bin/env bash
# yt2obsidian — macOS one-shot installer
#
# Installs yt2obsidian as a launchd user agent on macOS.
# Prereqs: Node.js 20+ (brew install node), npm/pnpm.
# Run from the repository root.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-3456}"
LABEL="com.geolonia.yt2obsidian"
PLIST_DEST="$HOME/Library/LaunchAgents/$LABEL.plist"

echo "==> yt2obsidian macOS installer"
echo "    repo dir: $REPO_DIR"
echo "    port:     $PORT"

# 1. Prerequisites
command -v node >/dev/null || { echo "Node.js not found. Install: brew install node"; exit 1; }
command -v npx >/dev/null || { echo "npx not found"; exit 1; }
command -v launchctl >/dev/null || { echo "launchctl not found (not macOS?)"; exit 1; }

NPX_PATH=$(which npx)
echo "    npx path: $NPX_PATH"

# 2. Install deps
cd "$REPO_DIR"
if [ -f pnpm-lock.yaml ] && command -v pnpm >/dev/null; then
  pnpm install
else
  npm install
fi

# 3. .env check (warn-only)
if [ ! -f .env ]; then
  echo "WARN: .env not found. Copy .env.example to .env and set ANTHROPIC_API_KEY"
  echo "      (server will run without summary if API key is missing)"
fi

# 4. Prepare log dir
mkdir -p "$HOME/Library/Logs"

# 5. Deploy launchd plist (replace hardcoded paths)
mkdir -p "$HOME/Library/LaunchAgents"
sed \
  -e "s|/Users/hal/workspace/yt2obsidian|$REPO_DIR|g" \
  -e "s|/Users/hal|$HOME|g" \
  -e "s|/usr/local/bin/npx|$NPX_PATH|g" \
  -e "s|<string>3456</string>|<string>$PORT</string>|g" \
  "$REPO_DIR/launchd/$LABEL.plist" \
  > "$PLIST_DEST"

# 6. (Re)load and start
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_DEST"
launchctl kickstart -k "gui/$(id -u)/$LABEL"

echo ""
echo "==> launchd status:"
launchctl list | grep "$LABEL" || echo "(not yet listed, may take a moment)"

cat <<EOF

==> Done.

Watch logs with:
  tail -f ~/Library/Logs/yt2obsidian.log

Verify endpoint:
  curl http://localhost:$PORT/health

If macOS firewall asks about incoming connections to 'node', click "Allow"
(required for Tailscale-based cross-device access).
EOF
