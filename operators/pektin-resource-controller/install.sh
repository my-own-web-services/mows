# run inside the manager container

kubectl apply -f /operators/pektin-resource-controller/yaml/crd.yaml && helm upgrade --install mows-core-dns-pektin-controller /operators/pektin-resource-controller/charts/pektin-resource-controller/ -n mows-core-dns-pektin --create-namespace && kubectl apply -f /operators/pektin-resource-controller/examples/domain-setup.yaml

kubectl patch crd/pektin.k8s.mows.cloud -p '{"metadata":{"finalizers":[]}}' --type=merge ; kubectl delete pektin.k8s.mows.cloud --all ; kubectl delete crd pektin.k8s.mows.cloud ; helm uninstall mows-core-dns-pektin-controller -n mows-core-dns-pektin 

kubectl port-forward service/mows-core-dns-pektin 8080:80 --address 0.0.0.0

kubectl apply -f /operators/pektin-resource-controller/yaml/example.yaml