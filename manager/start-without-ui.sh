#!/bin/bash

set -euo pipefail

docker build -t mows-manager . -f no-ui.Dockerfile

docker network create -d macvlan \
                    --subnet=192.168.122.0/24 \
                    --gateway=192.168.122.1 \
                    -o parent=virbr0 qemu_network || true

docker network create -d bridge mows-manager-bridge || true


docker run --net qemu_network --net mows-manager-bridge -p 3000:3000 --rm -v /var/run/libvirt/libvirt-sock:/var/run/libvirt/libvirt-sock -v ./temp-pxe-files:/pxe_files/ --name mows-manager mows-manager