#!/bin/bash

set -euo pipefail

cargo run --bin crdgen > yaml/crd.yaml

docker buildx bake

docker push localhost:5000/zitadel-controller
