#!/bin/bash

set -euo pipefail

rm -rf ./common-temp

cp ../common ./common-temp -r

docker build . -t localhost:5000/pektin-api -f Dockerfile

rm -rf ./common-temp

docker push localhost:5000/pektin-api 
