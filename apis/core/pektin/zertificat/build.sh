#!/bin/bash

set -euo pipefail

docker buildx bake

docker push localhost:5000/pektin-zertificat 
