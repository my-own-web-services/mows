#!/bin/bash

set -euo pipefail

docker build . -t localhost:5000/pektin-ribston -f Dockerfile
docker push localhost:5000/pektin-ribston 
