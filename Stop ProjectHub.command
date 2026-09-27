#!/bin/bash
# Double-click to stop ProjectHub. Your data is kept.
cd "$(dirname "$0")"
export PATH="$PATH:/Applications/Docker.app/Contents/Resources/bin:/usr/local/bin:/opt/homebrew/bin"
docker compose down && echo "ProjectHub stopped. Your data is kept."
read -r -p "Press Enter to close."
