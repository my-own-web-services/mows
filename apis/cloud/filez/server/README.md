```sh
kubectl patch crd/filezresources.filez.k8s.mows.cloud -p '{"metadata":{"finalizers":[]}}' --type=merge ; kubectl delete filezresources.filez.k8s.mows.cloud --all ; kubectl delete crd filezresources.filez.k8s.mows.cloud

```
