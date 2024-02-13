# the dhcp range must be in the same subnet as the host somehow the interface must be found out an configured
docker run -it --rm --cap-add="NET_ADMIN" --net=host ferrarimarco/pxe --dhcp-range=192.168.122.1,192.168.122.10
