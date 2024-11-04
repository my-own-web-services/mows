# run inside the manager container

kubectl apply -f /operators/pektin-dns-controller/yaml/crd.yaml && helm upgrade --install mows-core-dns-prc /operators/pektin-dns-controller/charts/vrc/ -n mows-core-dns-prc --create-namespace

kubectl patch crd/vaultresources.vault.k8s.mows.cloud -p '{"metadata":{"finalizers":[]}}' --type=merge ; kubectl delete vaultresources.vault.k8s.mows.cloud --all ; kubectl delete crd vaultresources.vault.k8s.mows.cloud ; helm uninstall mows-core-dns-prc -n mows-core-dns-prc ; kubectl delete ns mows-core-dns-prc

kubectl port-forward service/doc-mows-core-dns-prc 8080:80 --address 0.0.0.0

kubectl apply -f /operators/pektin-dns-controller/yaml/pektin-examples.yaml