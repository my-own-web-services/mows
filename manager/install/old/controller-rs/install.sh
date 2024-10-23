# run inside the manager container

kubectl apply -f /install/old/controller-rs/yaml/crd.yaml && helm upgrade --install mows-core-secrets-vrc /install/old/controller-rs/charts/doc-controller/ -n mows-core-secrets-vrc --create-namespace

kubectl port-forward service/doc-controller 8080:80 --address 0.0.0.0