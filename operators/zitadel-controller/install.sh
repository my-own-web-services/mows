# run inside the manager container

kubectl apply -f /operators/zitadel-controller/yaml/crd.yaml && helm upgrade --install mows-core-auth-zitadel-controller /operators/zitadel-controller/charts/zitadel-controller/ -n mows-core-auth-zitadel --create-namespace

kubectl patch crd/zitadel.k8s.mows.cloud -p '{"metadata":{"finalizers":[]}}' --type=merge ; kubectl delete zitadel.k8s.mows.cloud --all ; kubectl delete crd zitadel.k8s.mows.cloud ; helm uninstall mows-core-auth-zitadel-controller -n mows-core-auth-zitadel 

kubectl port-forward service/mows-core-auth-zitadel 8080:80 --address 0.0.0.0

kubectl apply -f /operators/zitadel-controller/yaml/example.yaml