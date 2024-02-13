#!/bin/bash

set -euo pipefail

kubectl apply -f https://kube-vip.io/manifests/rbac.yaml

export VIP=192.168.122.99
export IP=192.168.122.106

export INTERFACE=enp1s0

export KVVERSION=v0.6.4

docker run --rm ghcr.io/kube-vip/kube-vip:$KVVERSION manifest daemonset \
    --interface $INTERFACE \
    --address $VIP \
    --inCluster \
    --taint \
    --controlplane \
    --arp \
    --leaderElection > temp-manifest.yml

kubectl apply -f temp-manifest.yml

rm temp-manifest.yml

sed -i "s/${IP}/${VIP}/g" ~/.kube/config