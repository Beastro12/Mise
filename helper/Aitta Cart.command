#!/bin/bash
# Double-click in Finder: fill your S-kaupat cart from an Aitta list. You still place the order yourself.
cd "$(dirname "$0")/.." || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Get Node 22 from https://nodejs.org and try again."
  read -r -p "Press Enter to close."
  exit 1
fi
[ -d node_modules ] || npm install
read -r -p "Paste the list's share link (Aitta → list → Share) and press Enter: " LINK
node helper/skaupat-cart.mjs "$LINK" "$@"
read -r -p "Press Enter to close."
