#!/bin/bash

set -euo pipefail

rm -f temp/dnsmasq/leases

docker compose down qemu; docker compose up qemu --build --force-recreate