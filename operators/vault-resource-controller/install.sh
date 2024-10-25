# run inside the manager container

kubectl apply -f /operators/vault-resource-controller/yaml/crd.yaml && helm upgrade --install mows-core-secrets-vrc /operators/vault-resource-controller/charts/doc-controller/ -n mows-core-secrets-vrc --create-namespace

kubectl port-forward service/doc-controller 8080:80 --address 0.0.0.0

kubectl apply -f /operators/vault-resource-controller/yaml/pektin-examples.yaml