# repo url for gitlab

http://mows-core-gitea-http.mows-core-gitea:3000/gitea_admin/test.git

## tesseract command

`tesseract snapshot.jpeg content --user-words bios-words.txt`

`ustreamer -d /dev/video0 --host=0.0.0.0 --port=10000 -q 90 -r 1280x720 --drop-same-frames=120`

`v4l2-ctl --device /dev/video0 --info --concise --verbose`

## ipv6 fix

sudo ip6tables -I FORWARD 1 \
 -s 2001:168:112::/64 \
 -d ::/0 \
 -j ACCEPT

sudo ip6tables -I FORWARD 1 \
 -d 2001:168:112::/64 \
 -s ::/0 \
 -j ACCEPT

## ip ranges

192.168.112.

-   gateway: 1
-   mows-manager: 3
-   qemu: 4
-   registries: 5-10
-   mows-package-manager: 22
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

# bare minimum install

-   cilium
-   longhorn
-   vault
-   vrc
-   package-manager
