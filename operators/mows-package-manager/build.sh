#!/bin/bash
set -euo pipefail
export DEFAULT_REGISTRY="localhost:5000"

export SERVICE_NAME="mows-package-manager"


docker buildx bake ${BAKE_ARGS:-default}

docker push ${REGISTRY:-${DEFAULT_REGISTRY}}/${SERVICE_NAME}
