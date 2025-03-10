#!/bin/bash
set -euo pipefail


export SERVICE_NAME="pektin-server"

docker buildx bake ${BAKE_ARGS:-default}

docker push ${REGISTRY:-localhost:5000}/${SERVICE_NAME}
