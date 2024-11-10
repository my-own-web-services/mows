# run inside the manager container

kubectl apply -f /operators/vault-resource-controller/yaml/crd.yaml && helm upgrade --install mows-core-secrets-vrc /operators/vault-resource-controller/charts/vrc/ -n mows-core-secrets-vrc --create-namespace

#kubectl patch crd/vaultresources.vault.k8s.mows.cloud -p '{"metadata":{"finalizers":[]}}' --type=merge ; 

# delete
kubectl delete vaultresources.vault.k8s.mows.cloud --all -A ; kubectl delete crd vaultresources.vault.k8s.mows.cloud ; helm uninstall mows-core-secrets-vrc -n mows-core-secrets-vrc ; kubectl delete ns mows-core-secrets-vrc

kubectl port-forward service/doc-mows-core-secrets-vrc 8080:80 --address 0.0.0.0

kubectl apply -f /operators/vault-resource-controller/yaml/pektin-examples.yaml