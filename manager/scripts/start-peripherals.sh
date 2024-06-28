#!/bin/bash

set -euo pipefail

docker compose down qemu jaeger dhcp-qemu; docker compose up qemu jaeger dhcp-qemu --build --force-recreate