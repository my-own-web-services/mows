#!/bin/bash
set -euo pipefail


export SERVICE_NAME="vault-resource-controller"

cargo run --bin crdgen > charts/${SERVICE_NAME}/templates/VaultResourceCRD.yaml

cargo run --bin schemagen > VaultResourceCRDSchema.json

docker buildx bake ${BAKE_ARGS:-default}

docker push ${REGISTRY:-localhost:5000}/${SERVICE_NAME}
