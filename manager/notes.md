# repo url

http://mows-gitea-http.mows-gitea:3000/gitea_admin/test.git

## tesseract command

`tesseract snapshot.jpeg content --user-words bios-words.txt`

`ustreamer -d /dev/video0 --host=0.0.0.0 --port=10001 -q 90 -r 1280x720 --drop-same-frames=120`

`v4l2-ctl --device /dev/video0 --info --concise --verbose`

## ip ranges

192.168.112.

-   gateway: 1
-   mows-manager: 3
-   qemu: 4
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
