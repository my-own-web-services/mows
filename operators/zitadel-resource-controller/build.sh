#!/bin/bash
set -euo pipefail
export DEFAULT_REGISTRY="localhost:5000"
export SERVICE_NAME="zitadel-resource-controller"


cargo run --bin crdgen > charts/${SERVICE_NAME}/templates/CRD.yaml

docker buildx bake ${BAKE_ARGS:-default}

docker push ${REGISTRY:-${DEFAULT_REGISTRY}}/${SERVICE_NAME}
