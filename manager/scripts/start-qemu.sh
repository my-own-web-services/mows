#!/bin/bash

set -euo pipefail

rm -rf temp/dnsmasq/ || true

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

bash $SCRIPT_DIR/create-local-net.sh

docker compose down qemu ; docker compose up qemu --build -d