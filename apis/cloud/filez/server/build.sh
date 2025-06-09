#!/bin/bash
set -euo pipefail

export SERVICE_NAME="filez-server"

export BAKE_ARGS="${BAKE_ARGS:-default} --allow=fs.read=/home/paul/projects/mows"

export BUILDKIT_PROGRESS="plain"

docker buildx bake ${BAKE_ARGS:-default} 

docker push ${REGISTRY:-localhost:5000}/${SERVICE_NAME}
