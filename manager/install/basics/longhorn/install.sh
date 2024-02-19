#!/bin/bash
set -euo pipefail

DIR=$(dirname -- "$(readlink -f -- "$BASH_SOURCE")")

# kubectl -n longhorn-system patch -p '{"value": "true"}' --type=merge lhs deleting-confirmation-flag ; kubectl delete crd -l app.kubernetes.io/name=longhorn ; kubectl delete crd -l longhorn-manager ; for crd in $(kubectl get crd -o name | grep longhorn); do kubectl patch $crd -p '{"metadata":{"finalizers":[]}}' --type=merge; done;

helm repo add longhorn https://charts.longhorn.io

helm repo update

helm upgrade --install longhorn longhorn/longhorn --namespace longhorn-system --create-namespace --version 1.5.3 -f "${DIR}/values.yml"

kubectl apply -f "${DIR}/storage-classes/" # kubectl apply -f install/basics/longhorn/storage-classes/

kubectl apply -f "${DIR}/encryption-secret.yml" # kubectl apply -f install/basics/longhorn/encryption-secret.yml


# this will be automated with a kubernetes operator
# DRIVENAME=vdb ; sudo mkfs.ext4 /dev/${DRIVENAME} ; sudo mkdir -p /var/lib/longhorn/${DRIVENAME} ; sudo mount /dev/${DRIVENAME} /var/lib/longhorn/${DRIVENAME}

# could not pull image: sudo rm -rf /var/lib/rancher/k3s/agent/containerd/io.containerd.content.v1.content/ingest/*

