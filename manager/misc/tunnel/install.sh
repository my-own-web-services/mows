#!/bin/bash

set -euo pipefail

# Install wireguard

apt-get update -y && apt-get upgrade -y && apt-get install -y wireguard

# enable wireguard

systemctl enable --now wg-quick@wg0

echo "net.ipv4.ip_forward = 1" > /etc/sysctl.d/99-sysctl.conf
echo "net.ipv6.conf.all.forwarding = 1" >> /etc/sysctl.d/99-sysctl.conf


