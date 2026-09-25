#!/bin/bash
# Double-click in Finder: pick real S-kaupat products for your latest Aitta list.
cd "$(dirname "$0")/.." || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Get Node 22 from https://nodejs.org and try again."
  read -r -p "Press Enter to close."
  exit 1
fi
[ -d node_modules ] || npm install
node helper/skaupat-match.mjs "$@"
read -r -p "Press Enter to close."
