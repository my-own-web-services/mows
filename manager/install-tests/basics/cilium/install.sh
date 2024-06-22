#!/bin/bash

set -euo pipefail

helm repo add cilium https://helm.cilium.io/

helm upgrade --install --create-namespace cilium cilium/cilium --version 1.15.0 --namespace cilium --set operator.replicas=1 --set hubble.relay.enabled=true --set hubble.ui.enabled=true --set=ipam.operator.clusterPoolIPv4PodCIDRList="10.42.0.0/16" --set global.kubeProxyReplacement="strict" --set global.containerRuntime.integration="containerd" --set global.containerRuntime.socketPath="/var/run/k3s/containerd/containerd.sock"