#!/bin/bash

set -euo pipefail


NODE_NAME="test-machine"

sudo virt-install \
  --name "${NODE_NAME}" \
  --memory 2048 \
  --boot hd,network,menu=on \
  --pxe \
  --vcpus 2 \
  --os-variant generic \
  --disk "path=/var/lib/libvirt/images/${NODE_NAME}-primary.qcow2,size=20,format=qcow2,bus=virtio" \
  --network default,model=virtio \
  --rng /dev/urandom \
  --tpm "backend.type=emulator,backend.version=2.0,model=tpm-tis" \
  --noautoconsole 