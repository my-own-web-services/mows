#!/bin/bash
set -euo pipefail

mpm tools cargo-workspace-docker

export BUILDX_BAKE_ENTITLEMENTS_FS=0

export SERVICE_NAME="zitadel-resource-controller"


cargo run --bin crdgen > charts/${SERVICE_NAME}/templates/ZitadelResourceCRD.yaml

cargo run --bin schemagen > ZitadelResourceCRDSchema.json

docker buildx bake ${BAKE_ARGS:-default}

docker push ${REGISTRY:-localhost:5000}/${SERVICE_NAME}
