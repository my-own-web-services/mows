-   forward the libvirtd socket to the container
-   use a debian docker image or similar
-   use virt-install and virsh to manage the machines

--

-   paste config or create new cluster

`chmod 600 ~/.ssh/id ; ssh kairos@192.168.122.99 -o Preferredauthentications=publickey -i ~/.ssh/mows-GmpdECeoy6vfkrgsGB4ZfpeZSsKmprivate`

echo "-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAACmFlczI1Ni1jdHIAAAAGYmNyeXB0AAAAGAAAABDNys/SMK
tkGLIgCzEXAth4AAAAEAAAAAEAAAAzAAAAC3NzaC1lZDI1NTE5AAAAIGaJKkes1QCBwIm+
VPC2dAGWcnxJKty87R2uzPEVwU94AAAAoMa6sS+3sTVI3qIemv/iqRNmX7NUfbyQr0gR15
YZrCBLmjt7oBxH/9F+RG9PM9uerQSOqIeMPgD0K1+CXGZFphGhXYL8eSF+U/eNPokChwjj
AT+M1ZysT7ChGdzTZ1MmqNKPR+9wCilk93qVvaT1+b4BFRXi0P3Ym2Mn9N1K8PkQRho53Q
ZiE+ERUMPWZGmQTGyCu9CqPPe9Yghon0UWml8=
-----END OPENSSH PRIVATE KEY-----" > ~/.ssh/id

tokio-console

# BUGS

-   virt-manager can't connect to local spice server, https://github.com/virt-manager/virt-manager/issues/592 use remote-viewer/virt-viewer


1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
3: virbr0: <NO-CARRIER,BROADCAST,MULTICAST,UP> mtu 1500 qdisc noqueue state DOWN qlen 1000
    link/ether 52:54:00:c3:18:a7 brd ff:ff:ff:ff:ff:ff
    inet 192.168.122.1/24 brd 192.168.122.255 scope global virbr0
       valid_lft forever preferred_lft forever
4: br0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP qlen 1000
    link/ether 02:42:c0:a8:70:04 brd ff:ff:ff:ff:ff:ff
    inet 192.168.0.90/24 scope global br0
       valid_lft forever preferred_lft forever
14: vnet9: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel master br0 state UNKNOWN qlen 1000
    link/ether fe:54:00:f7:57:95 brd ff:ff:ff:ff:ff:ff
15: vnet10: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel master br0 state UNKNOWN qlen 1000
    link/ether fe:54:00:3d:84:79 brd ff:ff:ff:ff:ff:ff
16: vnet11: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel master br0 state UNKNOWN qlen 1000
    link/ether fe:54:00:c7:26:da brd ff:ff:ff:ff:ff:ff
51: eth0@if52: <BROADCAST,MULTICAST,UP,LOWER_UP,M-DOWN> mtu 1500 qdisc noqueue state UP 
    link/ether 02:42:ac:13:00:02 brd ff:ff:ff:ff:ff:ff
    inet 172.19.0.2/16 brd 172.19.255.255 scope global eth0
       valid_lft forever preferred_lft forever
57: pxe0@if58: <BROADCAST,MULTICAST,UP,LOWER_UP,M-DOWN> mtu 1500 qdisc noqueue master br0 state UP 
    link/ether 02:42:c0:a8:70:04 brd ff:ff:ff:ff:ff:ff
    inet 192.168.112.4/24 brd 192.168.112.255 scope global pxe0
       valid_lft forever preferred_lft forever