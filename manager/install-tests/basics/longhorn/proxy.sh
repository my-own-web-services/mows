#!/bin/bash

set -euo pipefail

echo "Longhorn dashboard is available at:"
echo ""
echo "http://localhost:8001/api/v1/namespaces/longhorn-system/services/http:longhorn-frontend:http/proxy/"

kubectl proxy