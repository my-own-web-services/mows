#!/bin/bash
set -euo pipefail


export SERVICE_NAME="pektin-resource-controller"


cargo run --bin crdgen > charts/${SERVICE_NAME}/templates/PektinResourceCRD.yaml

cargo run --bin schemagen > PektinResourceCRDSchema.json



docker buildx bake ${BAKE_ARGS:-default}

docker push ${REGISTRY:-localhost:5000}/${SERVICE_NAME}
