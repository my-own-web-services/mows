#!/bin/bash
set -euo pipefail

mpm tools cargo-workspace-docker

export SERVICE_NAME="vault-resource-controller"
export BUILDX_BAKE_ENTITLEMENTS_FS=0

cargo run --bin crdgen > charts/${SERVICE_NAME}/templates/VaultResourceCRD.yaml

cargo run --bin schemagen > VaultResourceCRDSchema.json

docker buildx bake ${BAKE_ARGS:-default}

docker push ${REGISTRY:-localhost:5000}/${SERVICE_NAME}
