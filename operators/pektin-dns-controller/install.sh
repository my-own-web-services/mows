# run inside the manager container

kubectl apply -f /operators/pektin-dns-controller/yaml/crd.yaml && helm upgrade --install mows-core-dns-pektin-controller /operators/pektin-dns-controller/charts/pektin-dns-controller/ -n mows-core-dns-pektin --create-namespace

kubectl patch crd/pektin.k8s.mows.cloud -p '{"metadata":{"finalizers":[]}}' --type=merge ; kubectl delete pektin.k8s.mows.cloud --all ; kubectl delete crd pektin.k8s.mows.cloud ; helm uninstall mows-core-dns-pektin-controller -n mows-core-dns-pektin 

kubectl port-forward service/mows-core-dns-pektin 8080:80 --address 0.0.0.0

kubectl apply -f /operators/pektin-dns-controller/yaml/example.yaml