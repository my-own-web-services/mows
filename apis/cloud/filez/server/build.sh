#!/bin/bash
set -euo pipefail

export SERVICE_NAME="filez-server"

export BAKE_ARGS="${BAKE_ARGS:-default} --allow=fs.read=/home/paul/projects/mows"

export BUILDKIT_PROGRESS="plain"

cargo run --bin crdgen > FilezResourceCRD.yaml
mv FilezResourceCRD.yaml ../charts/filez/templates/server/FilezResourceCRD.yaml


cargo run --bin schemagen > FilezResourceCRDSchema.json


docker buildx bake ${BAKE_ARGS:-default} 

docker push ${REGISTRY:-localhost:5000}/${SERVICE_NAME}

bash scripts/codegen.sh

