#!/bin/sh

# create the libvirt config file
cat > /etc/libvirt/libvirtd.conf <<EOF
listen_tls = 0
listen_tcp = 1
tcp_port = "16509"
listen_addr = "0.0.0.0"
auth_tcp = "none"
EOF


# Start the libvirtd daemon with config file
/usr/sbin/libvirtd --config /etc/libvirt/libvirtd.conf --listen

