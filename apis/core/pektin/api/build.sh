#!/bin/bash

set -euo pipefail

rm -rf ./pektin-common-temp
rm -rf ./mows-common-temp

cp ../common ./pektin-common-temp -r
cp ../../../../utils/mows-common ./mows-common-temp -r

docker build . -t localhost:5000/pektin-api -f Dockerfile

rm -rf ./pektin-common-temp
rm -rf ./mows-common-temp

docker push localhost:5000/pektin-api 
