# run inside the manager container

# install zitadel
k kustomize --enable-helm /install/core/auth/zitadel/ | kubectl apply --server-side -f -

# install controller
kubectl apply -f /operators/zitadel-controller/yaml/crd.yaml && helm upgrade --install mows-core-auth-zitadel-controller /operators/zitadel-controller/charts/zitadel-controller/ -n mows-core-auth-zitadel --create-namespace

# delete
kubectl patch crd/zitadelresources.zitadel.k8s.mows.cloud -p '{"metadata":{"finalizers":[]}}' --type=merge ; kubectl delete zitadelresources.zitadel.k8s.mows.cloud --all ; kubectl delete crd zitadelresources.zitadel.k8s.mows.cloud ; helm uninstall mows-core-auth-zitadel-controller -n mows-core-auth-zitadel 

# apply example zitadel resource
kubectl apply -f /operators/zitadel-controller/yaml/example.yaml