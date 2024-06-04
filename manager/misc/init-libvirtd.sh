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


# Start libvirtd daemonized then create the default network then stop it and bring it to the foreground
/usr/sbin/libvirtd --config /etc/libvirt/libvirtd.conf --listen -d

# Create the default network
virsh net-define /etc/libvirt/qemu/networks/default.xml
virsh net-start default
virsh net-autostart default

# Stop libvirtd
killall libvirtd


# Bring libvirtd to the foreground
/usr/sbin/libvirtd --config /etc/libvirt/libvirtd.conf --listen

