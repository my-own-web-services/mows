#!/bin/bash

set -euo pipefail

KAIROS_VERSION="v2.5.0"
K3S_VERSION="k3sv1.29.0+k3s1"
OS="opensuse-tumbleweed"


BASENAME="kairos-${OS}-standard-amd64-generic-${KAIROS_VERSION}-${K3S_VERSION}"


BASEURL="https://github.com/kairos-io/kairos/releases/download/${KAIROS_VERSION}/${BASENAME}"


wget -nc "${BASEURL}-kernel"
wget -nc "${BASEURL}-initrd"
wget -nc "${BASEURL}.squashfs"

printf "Using config: ${1}\n"

# This will start the pixiecore server.
# Any machine that depends on DHCP to netboot will be send the specified files and the cmd boot line.
docker run \
  --rm --name pixiecore --net=host -v $PWD:/files quay.io/pixiecore/pixiecore \
    boot /files/${BASENAME}-kernel /files/${BASENAME}-initrd --cmdline="rd.neednet=1 rd.live.overlay.overlayfs=1 ip=dhcp rd.cos.disable root=live:{{ ID \"/files/${BASENAME}.squashfs\" }} netboot nodepair.enable config_url={{ ID \"/files/config-${1}.yaml\" }} console=tty1 console=ttyS0 console=tty0"
