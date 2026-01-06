#!/bin/bash

set -euo pipefail

cluster_interface=enp14s0f4u2u2


# check if the interface is available
if ! ip a | grep $cluster_interface; then
    # set it to the default interface on the host
    cluster_interface=$(ip a | grep 'state UP' | awk '{print $2}' | head -n 1 | sed 's/://')
fi


echo "Using interface: '$cluster_interface' for PXE network"



# create a macvlan network
docker network create -d macvlan \
    --subnet=192.168.113.0/24 \
    --gateway=192.168.113.1 \
    -o parent=$cluster_interface \
    mows-manager-local || true