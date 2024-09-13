#!/bin/bash


set -euo pipefail

kubectl kustomize --enable-helm /install/argocd/core/cloudnative-pg | kubectl apply --server-side -f -

sleep 5

kubectl kustomize --enable-helm /install/argocd/core/argocd | kubectl apply -f -

sleep 5

kubectl kustomize --enable-helm /install/argocd/core/gitea | kubectl apply -f -

