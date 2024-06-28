#!/bin/bash

set -euo pipefail

# first argument is the version of kube-vip
export KVVERSION=$1

export VIP=192.168.122.99
export INTERFACE=enp1s0
export MANIFEST_PATH="./install/cluster-basics/kube-vip/manifest.yml"

docker run --rm ghcr.io/kube-vip/kube-vip:v$KVVERSION manifest daemonset \
    --interface $INTERFACE \
    --address $VIP \
    --inCluster \
    --taint \
    --controlplane \
    --services \
    --arp \
    --leaderElection > $MANIFEST_PATH

# replace the VIP with $$$VIP$$$
sed -i "s/${VIP}/\$\$\$VIP\$\$\$/g" $MANIFEST_PATH

# replace the interface with $$$VIP_INTERFACE$$$
sed -i "s/${INTERFACE}/\$\$\$VIP_INTERFACE\$\$\$/g" $MANIFEST_PATH

# replace the namespace: kube-system with mows-vip
sed -i "s/namespace: kube-system/namespace: mows-vip/g" $MANIFEST_PATH