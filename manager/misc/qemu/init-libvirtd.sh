#!/bin/sh

# create the libvirt config file
cat > /etc/libvirt/libvirtd.conf <<EOF
listen_tls = 0
listen_tcp = 1
tcp_port = "16509"
listen_addr = "0.0.0.0"
auth_tcp = "none"
EOF

cat > /etc/libvirt/qemu.conf <<EOF
vnc_listen = "0.0.0.0"
spice_listen = "0.0.0.0"
EOF


cat > ./install-network.xml <<EOF
<network>
  <name>mows-manager</name>
  <forward mode='bridge'/>
  <bridge name='br0'/>
</network>
EOF

# Start libvirtd daemonized then create the default network then stop it and bring it to the foreground
/usr/sbin/libvirtd --config /etc/libvirt/libvirtd.conf --listen -d

virsh net-destroy default ; virsh net-undefine default


virsh net-define ./install-network.xml 
virsh net-start mows-manager


pxe_interface_ip=192.168.112.4
# get the name of the interface with the pxe_interface_ip

pxe_interface=$(ip a | grep $pxe_interface_ip | awk '{print $7}')

echo "Using interface '$pxe_interface' for pxe"

ip link add name br0 type bridge
ip link set $pxe_interface master br0
ip address del 192.168.112.4/24 dev mows-manager0
ip link set br0 up
ip address add dev br0 192.168.112.4/24
ip route add default via 192.168.112.1 dev br0

# Stop libvirtd
killall libvirtd

sleep 2

# Bring libvirtd to the foreground
/usr/sbin/libvirtd --config /etc/libvirt/libvirtd.conf --listen 


