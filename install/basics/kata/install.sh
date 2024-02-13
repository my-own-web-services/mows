
git clone https://github.com/kata-containers/kata-containers.git --depth 1
cd kata-containers/tools/packaging/kata-deploy && kubectl apply -f kata-rbac/base/kata-rbac.yaml && kubectl apply -k kata-deploy/overlays/k3s