#!/bin/bash
set -euo pipefail

export SERVICE_NAME="zitadel-resource-controller"


cargo run --bin crdgen > charts/${SERVICE_NAME}/templates/ZitadelResourceCRD.yaml

cargo run --bin schemagen > ZitadelResourceCRDSchema.json

docker buildx bake ${BAKE_ARGS:-default}

docker push ${REGISTRY:-localhost:5000}/${SERVICE_NAME}
