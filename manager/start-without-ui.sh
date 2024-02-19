#!/bin/bash

set -euo pipefail

docker build -t mows-manager . -f no-ui.Dockerfile

docker network create -d macvlan \
    --subnet=192.168.122.0/24 \
    --gateway=192.168.122.1 \
    -o parent=virbr0 qemu_network || true

docker network create -d bridge mows-manager-bridge || true

DEV_NAME=enp3s0f0u2u4


docker network create -d macvlan \
    --subnet=192.168.111.0/24 \
    --gateway=192.168.111.1  \
    -o parent=${DEV_NAME} mows-manager-dhcp || true


#docker run \
#    --cap-add NET_ADMIN \
#    --net mows-manager-bridge \
#    --net mows-manager-dhcp \
#    -p 3000:3000 \
#    -p 6669:6669 \
#    --rm \
#    -v /var/run/libvirt/libvirt-sock:/var/run/libvirt/libvirt-sock #\
#    -v ./temp-pxe-files:/pxe_files/ \
#    --name mows-manager mows-manager



#sudo ip link set $DEV_NAME up || true
#sudo ip addr add 192.168.111.2/24 dev ${DEV_NAME} || true
#sudo ip addr add 192.168.111.3/24 dev ${DEV_NAME} || true





#sudo ip addr add 192.168.111.0/24 brd + dev ${DEV_NAME} || true



# dnsmasq -a 192.168.111.2 -p 0 --no-daemon --log-queries --dhcp-alternate-port=67 --dhcp-range=192.168.111.4,192.168.111.30,12h

#sudo ifconfig ${DEV_NAME}:1 192.168.111.2 netmask 255.255.255.0 up 
#sudo ifconfig ${DEV_NAME}:2 192.168.111.3 netmask 255.255.255.0 up 

#     --net qemu_network \
    #    -p 192.168.111.3:67:67/udp \
# -p 192.168.111.3:67:67/udp \
 #   -p 192.168.111.2:67:6767/udp \

# /sys/class/net/