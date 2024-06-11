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


cat > ./network.xml <<EOF
<network>
  <name>default</name>
  <forward mode="bridge" />
  <bridge name="br0" />
</network>
EOF

# Start libvirtd daemonized then create the default network then stop it and bring it to the foreground
/usr/sbin/libvirtd --config /etc/libvirt/libvirtd.conf --listen -d

#sudo iptables -A FORWARD -i virbr0 -o eth0 -j ACCEPT
#sudo iptables -A FORWARD -i eth0 -o virbr0 -j ACCEPT


#virsh net-destroy default ; virsh net-undefine default
virsh net-define /etc/libvirt/qemu/networks/default.xml #./network.xml # /etc/libvirt/qemu/networks/default.xml
virsh net-start default

virsh iface-bridge virbr0 eth0


# Stop libvirtd
killall libvirtd




# Bring libvirtd to the foreground
/usr/sbin/libvirtd --config /etc/libvirt/libvirtd.conf --listen

