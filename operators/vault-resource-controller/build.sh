#!/bin/bash

set -euo pipefail

cargo run --bin crdgen > yaml/crd.yaml

docker build . -t localhost:5000/controller-rs -f Dockerfile

docker push localhost:5000/controller-rs 