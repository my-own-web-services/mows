#!/bin/bash

set -euo pipefail

rm -rf temp/dnsmasq/ || true

docker compose down qemu; docker compose up qemu --build --force-recreate