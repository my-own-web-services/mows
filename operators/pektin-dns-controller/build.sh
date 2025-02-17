#!/bin/bash

set -euo pipefail

cargo run --bin crdgen > charts/pektin-dns-controller/templates/CRD.yaml

docker buildx bake

docker push localhost:5000/pektin-dns-controller
