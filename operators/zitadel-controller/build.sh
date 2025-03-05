#!/bin/bash

set -euo pipefail

cargo run --bin crdgen > charts/zitadel-controller/templates/CRD.yaml

docker buildx bake 

docker push localhost:5000/zitadel-controller
