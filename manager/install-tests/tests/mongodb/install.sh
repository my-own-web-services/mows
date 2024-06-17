#!/bin/bash
set -euo pipefail

DIR=$(dirname -- "$(readlink -f -- "$BASH_SOURCE")")

helm repo add bitnami https://charts.bitnami.com/bitnami

helm upgrade --install mongodb bitnami/mongodb --version 14.8.3 --namespace mongodb --create-namespace -f "${DIR}/values.yml"