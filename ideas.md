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
-   kata container
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
-   shutdown nodes for maintance to run memchecks
-   simulate and test new cluster after update before actually updating
-   run backups
-   automatic backup testing in vm
-   run failure predictions for drives

### user related

-   manage lifecycle of applications (install, update, monitor)

`sudo virsh net-destroy default`

# serial

`sudo putty /dev/ttyUSB0 -serial -sercfg 115200,8,n,1,N`
