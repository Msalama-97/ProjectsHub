#!/bin/bash
# Double-click to deploy (or update) ProjectHub on your server.
cd "$(dirname "$0")"
DEFAULT="root@13.140.183.156"
echo "== Deploy ProjectHub =="
read -r -p "Server [$DEFAULT]: " TARGET
TARGET=${TARGET:-$DEFAULT}
echo
echo "If asked, type the server's password (nothing shows while you type) and press Enter."
echo
bash scripts/deploy.sh "$TARGET"
status=$?
echo
[ $status -ne 0 ] && echo "Deployment stopped with an error — copy the text above and send it to Claude."
read -r -p "Press Enter to close."
