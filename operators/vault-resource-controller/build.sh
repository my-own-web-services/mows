#!/bin/bash

set -euo pipefail

cargo run --bin crdgen > charts/vrc/templates/CRD.yaml

docker buildx bake

docker push localhost:5000/vault-resource-controller
