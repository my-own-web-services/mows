
helm upgrade redis-operator ot-helm/redis-operator --install --namespace redis-operator --create-namespace


kubectl apply -f /operators/vault-resource-controller/yaml/crd.yaml && helm upgrade --install mows-core-secrets-vrc /operators/vault-resource-controller/charts/vrc/ -n mows-core-secrets-vrc --create-namespace

helm upgrade mows-core-dns-pektin /apis/core/pektin/charts/pektin --create-namespace --namespace mows-core-dns-pektin --install