#!/bin/bash

set -euo pipefail


docker build -t mows-manager .
docker run --net=host --rm -v /var/run/libvirt/libvirt-sock:/var/run/libvirt/libvirt-sock -v ./temp-pxe-files:/pxe_files/ --name mows-manager mows-manager 
