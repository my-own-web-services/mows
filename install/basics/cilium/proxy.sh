#!/bin/bash

set -euo pipefail

echo "Cilium dashboard is available at:"
echo ""
echo "http://localhost:8001/api/v1/namespaces/cilium/services/http:hubble-ui:http/proxy/"

kubectl proxy