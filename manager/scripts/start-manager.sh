#!/bin/bash

set -euo pipefail

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

# if the first argument is --edit-local-dns-config, then this variable will be set to true
edit_local_dns_config=false

for arg in "$@"
do
    if [ "$arg" == "--edit-local-dns-config" ]; then
        edit_local_dns_config=true
        break
    fi
done


if [ "$edit_local_dns_config" == true ]; then
    # backup the original file
    sudo cp /etc/resolv.conf /etc/resolv.conf.bak
fi




docker compose down mows-manager; docker compose create mows-manager --build || true

if [ "$edit_local_dns_config" == true ]; then
    echo "nameserver 192.168.112.3" | sudo tee /etc/resolv.conf || true
fi




docker compose up mows-manager || true


if [ "$edit_local_dns_config" == true ]; then
    echo "restarting resolvconf"
    bash $SCRIPT_DIR/reset-dhcp.sh
fi


