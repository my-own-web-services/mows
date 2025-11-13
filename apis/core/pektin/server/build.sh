#!/bin/bash
set -euo pipefail


export SERVICE_NAME="pektin-server"
export BUILDX_BAKE_ENTITLEMENTS_FS=0

docker buildx bake ${BAKE_ARGS:-default}

docker push ${REGISTRY:-localhost:5000}/${SERVICE_NAME}
