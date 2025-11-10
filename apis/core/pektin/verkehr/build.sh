#!/bin/bash
set -euo pipefail


export SERVICE_NAME="verkehr"
export PROFILE="release"

export BAKE_ARGS="${BAKE_ARGS:-default} --allow=fs.read=/home/paul/projects/mows"

cargo run --bin crdgen > VerkehrResourceCRD.yaml
mv VerkehrResourceCRD.yaml ./charts/verkehr/templates/VerkehrResourceCRD.yaml

cargo run --bin schemagen > VerkehrResourceCRDSchema.json



docker buildx bake ${BAKE_ARGS:-default}

docker push ${REGISTRY:-localhost:5000}/${SERVICE_NAME}
