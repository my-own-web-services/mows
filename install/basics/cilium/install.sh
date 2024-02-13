#!/bin/bash

set -euo pipefail

helm repo add cilium https://helm.cilium.io/

helm upgrade --install --create-namespace cilium cilium/cilium --version 1.15.0 --namespace cilium --set operator.replicas=1 --set hubble.relay.enabled=true --set hubble.ui.enabled=true