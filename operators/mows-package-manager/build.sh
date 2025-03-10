#!/bin/bash
set -euo pipefail


export SERVICE_NAME="mows-package-manager"


docker buildx bake ${BAKE_ARGS:-default}

docker push ${REGISTRY:-localhost:5000}/${SERVICE_NAME}
