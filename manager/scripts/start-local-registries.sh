#!/bin/bash

set -euo pipefail

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

docker compose down mows-dev-local-registry || true

docker compose up mows-dev-local-registry mows-dev-pull-through-cache-docker mows-dev-pull-through-cache-quay mows-dev-pull-through-cache-gcr mows-dev-pull-through-cache-k8s mows-dev-pull-through-cache-ghcr -d