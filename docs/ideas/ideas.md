3 pi zero 2 w etcd cluster
and as many computing nodes as we like

with engine v2 longhorn is pretty fast and provides the easiest interface and ux

-   2 external backups with min.io best at 2 different locations raspi with external drives?

# network

-   local egress/ingress
-   public egress/ingress
-   vpn egress/ingress
-   tor egress/ingress

# workload

-   container
-   Kata container
-   confidential container
-   vm

# storage

-   hdd
-   ssd

# control

## cluster manager (external to the cluster)

1 local docker container on node 0 with a web interface that can be used to bootstrap the cluster

-   install system
-   decrypt the system on restart
-   shutdown the system
-   restore the full system from backup
-   setup the backup nodes
-   add nodes
-   remove nodes

--

-   store full config and password in one file that can be stored in a password manager that gets replicated on the cluster and backup nodes?

--

-   Insert config (or generate empty one)
-   check connection to nodes (if they are present in the config)
-   check state of the system

What do you want to do?

Setup new system?

Recover from backup?
Shutdown?
Start?
Setup a new node?

1. analyze environment to find potential cluster nodes and present them to the user

## cluster operator (internal)

### system related

-   handle the addition and removal of hard drives, shutting down the node and adding new drives to longhorn
-   run self checks, auto detect and fix issues that may arise
-   update nodes (one after another)
-   shutdown nodes for maintenance to run memchecks
-   simulate and test new cluster after update before actually updating
-   run backups
-   automatic backup testing in vm
-   run failure predictions for drives

### user related

-   manage lifecycle of applications (install, update, monitor)

`sudo virsh net-destroy default`

# serial

`sudo putty /dev/ttyUSB0 -serial -sercfg 115200,8,n,1,N`

# add ip to interface

`sudo ip addr add 192.168.1.2/24 dev enp3s0f0u2u4`

# update submodule git

`git submodule update --init`

`docker run --net=host --cap-add=NET_ADMIN -e DHCP_RANGE_START=192.168.1.3 samdbmg/dhcp-netboot.xyz`

the fix is to use the home network dhcp server or create a basic one ourself in the container listening on another ip addr

the first variant might not always work but provides the "working" network config out of the box, its traffic would not be secure as it could be intercepted at any point in the network

the second option requires the direct connection but will always work and be encrypted, when then switching to the real network the config will be wrong and we will need to find out the new ip address of each node, this should not be a problem though

option 16 will also probably work as it is netboot over http (wireshark knows this) but it was hard to find elsewhere what option 16 meant

the whole reason is that pixiecore has no real dhcp server but only a proxy one to use with another dhcp server
this is why it worked so flawless with qemu which has a dhcp server built in

RTFM xD but also there where multiple issues making this difficult to figure out

`sudo journalctl -u k3s.service`

# parts

hardware setup

operating system platform

apis

applications
