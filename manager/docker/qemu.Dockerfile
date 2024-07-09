FROM alpine

RUN apk add --no-cache \
    supervisor \
    ovmf \
    swtpm \
    seabios \
    libvirt-client \
    libvirt-daemon \
    libvirt-common-drivers \
    libvirt-qemu \
    qemu-system-x86_64 \
    qemu-audio-alsa \
    qemu-audio-oss \
    qemu-audio-pa \
    qemu-audio-sdl \
    qemu-audio-spice \
    qemu-block-curl \
    qemu-block-dmg-bz2 \
    qemu-block-nfs \
    qemu-block-ssh \
    qemu-chardev-spice \
    qemu-hw-display-qxl \
    qemu-hw-display-virtio-gpu \
    qemu-hw-display-virtio-gpu-pci \
    qemu-hw-display-virtio-vga \
    qemu-hw-usb-redirect \
    qemu-img \
    virt-viewer \
    openvswitch \
    virt-install


COPY ./misc/supervisord.conf /etc/supervisord.conf
COPY ./misc/init-libvirtd.sh /init-libvirtd.sh
RUN chmod +x /init-libvirtd.sh

STOPSIGNAL SIGKILL


CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]