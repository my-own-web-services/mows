#!/bin/bash

set -euo pipefail

# Install wireguard
apt-get update -y && apt-get upgrade -y && apt-get install -y wireguard


# Enable IP forwarding
echo "net.ipv4.ip_forward = 1" > /etc/sysctl.d/99-sysctl.conf
echo "net.ipv6.conf.all.forwarding = 1" >> /etc/sysctl.d/99-sysctl.conf

# echo the wgfile with multiline string

cat <<EOF > /etc/wireguard/wg0.conf

[Interface]
PrivateKey = ABGBR8j5AE8nv42CNSPvT84whKIhdSzN/G0xWecY2lQ=
ListenPort = 55107
Address = 10.0.0.1/32, fd01::1/128

[Peer]
PublicKey = R+4cJJUPiNHt/jXugUx5VMqf8yr2GtlgIl1olZXBqmI=
AllowedIPs = 10.0.0.2/32, fd01::2/128

EOF


iptables -t nat -A PREROUTING -p tcp -i eth0 '!' --dport 22 -j DNAT --to-destination 10.0.0.2; iptables -t nat -A POSTROUTING -o eth0 -j SNAT --to-source 188.245.70.117

iptables -t nat -A PREROUTING -p udp -i eth0 '!' --dport 55107 -j DNAT --to-destination 10.0.0.2;


# enable wireguard
systemctl enable --now wg-quick@wg0

