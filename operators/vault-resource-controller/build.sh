#!/bin/bash

set -euo pipefail

cargo run --bin crdgen > yaml/crd.yaml


rm -rf ./common-temp

cp ../../apis/core/pektin/common ./common-temp -r

docker build . -t localhost:5000/vault-resource-controller -f Dockerfile


rm -rf ./common-temp

docker push localhost:5000/vault-resource-controller
