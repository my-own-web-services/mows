#!/bin/bash
set -euo pipefail

mpm tools cargo-workspace-docker

export SERVICE_NAME="filez-apps-backend-metadata"

export BAKE_ARGS="${BAKE_ARGS:-default} --allow=fs.read=/home/paul/projects/mows"

export BUILDKIT_PROGRESS="plain"

docker buildx bake ${BAKE_ARGS:-default} 

docker push ${REGISTRY:-localhost:5000}/${SERVICE_NAME}
