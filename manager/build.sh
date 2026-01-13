#!/bin/bash
set -euo pipefail

mpm tools cargo-workspace-docker

export SERVICE_NAME="mows-manager"


docker buildx bake ${BAKE_ARGS:-default}

docker push ${REGISTRY:-localhost:5000}/${SERVICE_NAME}
