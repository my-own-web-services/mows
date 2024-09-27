#!/bin/bash

set -euo pipefail

# first argument is the version of kube-vip
export KVVERSION=$1

export VIP=192.168.122.99
export INTERFACE=enp1s0
export MANIFEST_PATH="./install/core-apis/kube-vip/manifest.yml"

docker run --rm ghcr.io/kube-vip/kube-vip:v$KVVERSION manifest daemonset \
    --interface $INTERFACE \
    --address $VIP \
    --inCluster \
    --taint \
    --controlplane \
    --arp \
    --leaderElection > $MANIFEST_PATH

# replace the VIP with $$$VIP$$$
sed -i "s/${VIP}/\$\$\$VIP\$\$\$/g" $MANIFEST_PATH

# replace the interface with $$$VIP_INTERFACE$$$
sed -i "s/${INTERFACE}/\$\$\$VIP_INTERFACE\$\$\$/g" $MANIFEST_PATH

# replace the namespace: kube-system with mows-core-network-kubevip
sed -i "s/namespace: kube-system/namespace: mows-core-network-kubevip/g" $MANIFEST_PATH

echo "you might have to add this manually to $MANIFEST_PATH"

cat <<EOF
...
        volumeMounts:
        - mountPath: /etc/kubernetes/admin.conf
          name: kubeconfig
      hostNetwork: true
      hostAliases:
      - hostnames:
        - kubernetes
        ip: 127.0.0.1
      volumes:
      - hostPath:
          path: /etc/rancher/k3s/k3s.yaml
        name: kubeconfig
EOF

echo "see https://github.com/kube-vip/kube-vip/issues/721"