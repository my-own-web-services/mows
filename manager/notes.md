# Methods of deployment

## manual imperative local kubectl or helm

-   no versioning
-   no safety guarantees but the ones provided by the admission controller (kyverno (can be skipped by labeling the namespace))

## declarative manual administered argocd

-   manual commit
-   manual argocd app definition
-   commit signing
-   no safety guarantees but the ones provided by the admission controller (kyverno (can be skipped by labeling the namespace))

## mows raw

-   primarily for apps that aren't build for mows directly
-   allows every resource directly
-   must comply with mows standards to properly integrate with all other components, won't be checked (maybe warned)
-   by default completely namespace isolated, network, k8s resources, secrets, namespace resource quotas
-   everything is possible but must be declared and allowed by the admin to loosen restrictions like network isolation

### deployment process

1. get files from repo or url or fs or similar (helm values, dnsRecord, ingressroute etc.)
2. render helm
3. replace variables from vault (domain names, actual service names etc.)
4. ensure safety (ensure all resource have the correct namespace, confirm mows sudo actions)
5. commit to git (and sign with admins key)
6. create argocd app definition and push it to the cluster
7. sync to cluster with argocd (check signing key)

## mows app

-   simplified deployment for apps that are build for mows with a custom manifest that then gets expanded to raw k8s resources
-   automatic setup of internal network policies etc. (app needs a pg-db, db is deployed and network policies that only allow the app talking to the db are applied)
-   no manual setup of secrets for app and db
-   automatic resource setup for auth, metrics, tracing etc.
-   mows app can be rendered into raw resources to be used by more complex apps built with mows raw

### deployment process

After creating the raw k8s resources from the mows app manifest, the deployment follows the same process as the raw app

---

# repo url for gitlab

http://mows-core-gitea-http.mows-core-gitea:3000/gitea_admin/test.git

## tesseract command

`tesseract snapshot.jpeg content --user-words bios-words.txt`

`ustreamer -d /dev/video0 --host=0.0.0.0 --port=10000 -q 90 -r 1280x720 --drop-same-frames=120`

`v4l2-ctl --device /dev/video0 --info --concise --verbose`

## ip ranges

192.168.112.

-   gateway: 1
-   mows-manager: 3
-   qemu: 4
-   registries 5-10
-   dhcp: 41-252
-   control-plane-vip: 254
-   service-vip: 253

cluster-cidr: 10.42.0.0/16
service-cidr: 10.43.0.0/16
static-internal: 10.41.0.0/24

tokio-console

# hardware netboot bios

Advanced Tab > Network Stack Configuration > Network Stack > Enabled
Advanced Tab > Network Stack Configuration > IPv4 PXE Support > Enabled
