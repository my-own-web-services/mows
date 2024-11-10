#!/bin/bash

set -euo pipefail

rm -rf ./mows-common-temp
rm -rf ./acme-rs-temp

cp ../../../../utils/mows-common ./mows-common-temp -r

cp ../acme-rs ./acme-rs-temp -r

docker build . -t localhost:5000/pektin-zertificat -f Dockerfile

rm -rf ./mows-common-temp
rm -rf ./acme-rs-temp

docker push localhost:5000/pektin-zertificat 
