#!/bin/bash

set -euo pipefail

cargo run --bin crdgen > yaml/crd.yaml

rm -rf ./pektin-common-temp
rm -rf ./mows-common-temp

cp ../../apis/core/pektin/common ./pektin-common-temp -r
cp ../../utils/mows-common ./mows-common-temp -r

docker build . -t localhost:5000/pektin-dns-controller -f Dockerfile

rm -rf ./pektin-common-temp
rm -rf ./mows-common-temp

docker push localhost:5000/pektin-dns-controller
