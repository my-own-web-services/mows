#!/bin/bash

set -euo pipefail

cargo run --bin crdgen > yaml/crd.yaml


rm -rf ./mows-common-temp

cp ../../utils/mows-common ./mows-common-temp -r


docker build . -t localhost:5000/vault-resource-controller -f Dockerfile


rm -rf ./mows-common-temp


docker push localhost:5000/vault-resource-controller
