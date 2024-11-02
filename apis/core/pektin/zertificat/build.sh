#!/bin/bash

set -euo pipefail

rm -rf ./common-temp
rm -rf ./acme-rs-temp

cp ../common ./common-temp -r

cp ../acme-rs ./acme-rs-temp -r

docker build . -t localhost:5000/pektin-zertificat -f Dockerfile

rm -rf ./common-temp
rm -rf ./acme-rs-temp

docker push localhost:5000/pektin-zertificat 
