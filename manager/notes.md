1. wildcard records do not work properly in pektin-server?
2. the traceid of mows-common reqwest is empty, this might be why the traces arent showing up as related in jaeger

# primary domain setup

create userpass auth method for the manager to control pektin

## on request to add a domain

create pektin signer for domain with manager vault root token
enable manager to have full access to pektin
enable primary domain to be created from manager

pektin api should create the signer for a domain itself

# create pektin controller

# create public ip controller

cr that can create any dns entry in pektin and could also configure pihole for multicast dns

#

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
