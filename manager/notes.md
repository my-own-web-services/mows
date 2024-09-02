## tesseract command

tesseract snapshot.jpeg content --user-words bios-words.txt

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

# BUGS

-   virt-manager can't connect to local spice server, https://github.com/virt-manager/virt-manager/issues/592 use remote-viewer/virt-viewer

# hardware netboot bios

Advanced Tab > Network Stack Configuration > Network Stack > Enabled
Advanced Tab > Network Stack Configuration > IPv4 PXE Support > Enabled
