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

# /etc/libvirt/qemu/networks/default.xml
cat > ./default-network.xml <<EOF
<network>
  <name>default</name>
  <uuid>fde0e776-36bb-4566-89ca-a3deaaa71262</uuid>
  <forward mode='nat'/>
  <bridge name='virbr0' stp='on' delay='0'/>
  <mac address='52:54:00:c3:18:a7'/>
  <ip address='192.168.122.1' netmask='255.255.255.0'>
    <dhcp>
      <range start='192.168.122.2' end='192.168.122.254'/>
    </dhcp>
  </ip>
</network>
EOF




# Start libvirtd daemonized then create the default network then stop it and bring it to the foreground
/usr/sbin/libvirtd --config /etc/libvirt/libvirtd.conf --listen -d

virsh net-destroy default ; virsh net-undefine default
virsh net-define ./default-network.xml
virsh net-start default

virsh net-define ./install-network.xml 
virsh net-start mows-manager



#ip link add virbr0 type bridge
#ip address ad dev virbr0 10.25.0.1/24
#ip link set dev virbr0 up


pxe_interface_ip=192.168.112.4
# get the name of the interface with the pxe_interface_ip

pxe_interface=$(ip a | grep $pxe_interface_ip | awk '{print $7}')

echo "Using interface '$pxe_interface' for pxe"

ip link add name br0 type bridge
ip link set $pxe_interface master br0
ip link set br0 up
ip address add dev br0 192.168.0.90/24




# Stop libvirtd
killall libvirtd




# Bring libvirtd to the foreground
/usr/sbin/libvirtd --config /etc/libvirt/libvirtd.conf --listen


# # Ensure directories exist
# mkdir -p /etc/openvswitch
# mkdir -p /var/run/openvswitch

# # Create Open vSwitch database if it doesn't exist
# if [ ! -f /etc/openvswitch/conf.db ]; then
#     ovsdb-tool create /etc/openvswitch/conf.db /usr/share/openvswitch/vswitch.ovsschema
# fi

# # Start the OVSDB server and vswitchd daemon directly
# ovsdb-server --remote=punix:/var/run/openvswitch/db.sock --remote=db:Open_vSwitch,Open_vSwitch,manager_options --pidfile --detach
# ovs-vsctl --no-wait init
# ovs-vswitchd --pidfile --detach

# # Create the OVS bridge if it doesn't exist
# ovs-vsctl br-exists br0 || ovs-vsctl add-br br0

# # Add the existing eth0 interface to the OVS bridge
# ovs-vsctl add-port br0 eth0

