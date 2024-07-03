#!/bin/bash

set -euo pipefail

rm temp/dnsmasq/leases

docker compose down qemu; docker compose up qemu --build --force-recreate