1. manually install argo, cilium kubevip and longhorn with manager
2. add argo app definitions, install vault and eso
3. setup and unseal vault, save the tokens into the manager config
4. configure eso to work with vault
5. this should be everything for the core apis, the mows operator should take it from there

operator with gitWeb or directly gitea?

cloud apis

-   pg
-   gitea
-   prometheus
-   grafana
-   kyverno
-   ingress
-   cert manager
-   dns
-   zitadel

# repo url

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
-   registry 5
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
