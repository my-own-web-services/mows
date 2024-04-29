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

# bios butler

Similar concepts / inspiration:

General:

-   Big Tech Cloud services
-   Nextcloud (File cloud)
-   https://umbrel.com/umbrelos (Home Server OS)
-   https://casaos.io/ (Home Server OS)
-   https://www.cloudron.io/ (Server OS)

-   https://supabase.com/ (Web APIs)

-   https://forums.serverbuilds.net/t/guide-remote-gaming-on-unraid/4248/7 (Game/Desktop Streaming)
-   https://www.igel.de/ (Thin clients and desktop streaming)

Other Systems

-   https://yunohost.org/#/ (Server OS)
-   https://sandstorm.org/ (Server OS)
-   https://start9.com/ (Server OS)
-   https://caprover.com/ (Server OS)

-   https://www.youtube.com/watch?v=wTQeMkYRMcw (File Manager)

WILL make it possible
umformulieren dass man merkt dass es um die idee/vision geht und nicht ready

WHAT can mows do

MOWS is the ALL in one solution for

## MOWS OS

-   A reliable platform
-   Simplifying Kubernetes
-   Escape the Lab

-   Running desktop OS
-   Running home assistant
-   Blocking Ads

-   increase reliability
-   Reduce maintenance
-   Reduce Cost
-   Resolving dns
-   Run your email
-   Run you game servers
-   Run your file sync
-   Run your media streaming
-   Your password manager
-   Your chatbot
-   Your dev environment
-   Your Shop
-   Your blog
-   Your social media

-   one unified system to build apps on with any technology you like
-   dont rebuild the same things over and over

-   break out the lab

mainframes to pcs
data center to personal server

I want to create a suite of tools to make it easy for anyone to start their own cloud system, one part is the operating system, it built from kubernetes and other parts of the cloud native landscape making it possible to run containers and virtual machines across multiple computers reliably and with strong resource and network isolation providing high security. the system can also run on any machine in the cloud or combination of cloud and local servers and is not limited to home use. it can be grown to any number of machines making it usable for schools organizations institutions and businesses. It runs a mail-server, a dns server, and gives both of them the needed static public ip address by creating a proxy server at some cloud provider with a static ip that is only made for the purpose of forwarding traffic, the connection stays tls encrypted. a change in the way providers give out static ip addresses must me made politically and can only be made once ipv4 is phased out.
components of the core system will be:

-   kubernetes/etcd with k3s through kairos
-   the operator that configures the apis below according to the apps needs provided in their manifest, the admin that can install those apps can adjust what resources to give the app access to (Storage, compute,memory,network, other apis), per default every app is completely isolated as if it was a virus
-   storage provider (longhorn)
-   networking provider (cilium)
-   dns provider/server (pektin)
-   secret provider(maybe vault)
-   reverse proxy (traefik, verkehr or similar)
-   runtimes: kubevirt, kata, containers
-   monitoring: prometheus/grafana
-   virtual ip: kubevip
-   authentication: zitadel
-   policy evaluator
-   static app server
-   ingress/egress provider: TOR/VPN/Public IP/Local network

possibilities are for example:
with the use of vms you can host and then stream any operating system from the cluster to any thin client or any other device using a web browser.

the containers can provide existing web applications for home automation, network ad blocking, crypto nodes, gitlab, etherpad and many more that exist in that realm.

it will support automatic backups to a third machine.
all machines in the cluster and also the backup machines will be set up and configured automatically by a program(manager).
failing nodes and hard drives can be exchanged too by using this program.

the hardware side of the project provides an idea of a basic setup to use at home featuring 3 cheap mini pcs connected together, that can be setup automatically with the manager.

the api side of the project will provide web/http/grpc apis that are meant to make app building easier similar to firebase or supabase, so that things like auth, file management in the backend etc. can be interoperable between web-apps and mustn't be recreated all the time by the apps themselves.
it will also feature frontend framework components to further simplify the creation of web apps with the apis.
Other apis include:

-   AI model access
-   notifications with mail, signal, push or anything else
-   configuration api to respect user preferences like color themes, code editor themes etc.
-   realtime api with channels for anything realtime
-   federation apis for easy integration with other instances
-   payment apis, either external or through crypto
-   statistics api
-   file management includes:

    -   client components for synced offline and online storage
    -   creation of file previews, for raw images, pdfs etc. converting videos in multiple formats
    -   search, tagging, sorting, applying metadata etc.

-   maps api, data from osm converted into tiles and searchable database for location lookup, things like that need a collaborative effort that could maybe achieved with a collaboration/federation api

when the apis are ready the primary focus is to build well integrated progressive web apps that can be mostly built out of api building blocks.
