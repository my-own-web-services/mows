#!/bin/bash


set -euo pipefail

kubectl kustomize --enable-helm /install/core/cloudnative-pg | kubectl apply --server-side -f -

sleep 5

kubectl kustomize --enable-helm /install/core/argocd | kubectl apply -f -

sleep 5

kubectl kustomize --enable-helm /install/core/gitea | kubectl apply -f -

