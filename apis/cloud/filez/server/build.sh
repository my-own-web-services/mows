#!/bin/bash
set -euo pipefail

mpm tools cargo-workspace-docker

export SERVICE_NAME="filez-server"

export BAKE_ARGS="${BAKE_ARGS:-default} --allow=fs.read=/home/paul/projects/mows --set *.args.APP_STAGE_IMAGE=alpine"

export BUILDKIT_PROGRESS="plain"

cargo run --bin crdgen > FilezResourceCRD.yaml
mv FilezResourceCRD.yaml ../charts/filez/templates/server/FilezResourceCRD.yaml


cargo run --bin schemagen > FilezResourceCRDSchema.json

cargo run --bin gen_migrations


docker buildx bake ${BAKE_ARGS:-default} 

docker push ${REGISTRY:-localhost:5000}/${SERVICE_NAME}

bash scripts/codegen.sh

