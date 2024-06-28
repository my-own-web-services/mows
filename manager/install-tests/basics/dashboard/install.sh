#!/bin/bash

DIR=$(dirname -- "$(readlink -f -- "$BASH_SOURCE")")



helm upgrade --install kubernetes-dashboard kubernetes-dashboard/kubernetes-dashboard --version 6.0.8 -f "${DIR}/values.yml" --namespace kubernetes-dashboard --create-namespace

kubectl delete clusterrolebindings.rbac.authorization.k8s.io kubernetes-dashboard
kubectl apply -f "${DIR}/dashboard-admin.yml"

