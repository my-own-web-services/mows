#!/bin/bash

set -euo pipefail

docker compose down qemu dhcp; docker compose up qemu dhcp --build --force-recreate