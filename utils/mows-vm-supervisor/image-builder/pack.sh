#!/bin/sh
# Pack a rootfs into a bootable qcow2 disk image.
#
# Inputs:
#   $1 — rootfs directory (e.g. /rootfs)
#   $2 — output directory  (e.g. /out)
#
# Inputs via env:
#   SOURCE_DATE_EPOCH   — pinned timestamp (mandatory for reproducibility)
#   TARGETARCH          — amd64 | arm64 (only amd64 wired today)
#
# Output:
#   $2/alpine-mows-agent-${TARGETARCH}.qcow2
#   $2/alpine-mows-agent-${TARGETARCH}.qcow2.sha256
#
# Implementation note: this runs inside `docker buildx`, so loop devices and
# kernel mounts are unavailable. We use `mkfs.ext4 -d` to populate the
# filesystem directly from `${ROOTFS}` and skip the bootloader + initramfs
# entirely — the supervisor boots the VM via QEMU's `-kernel` / `-initrd`
# instead, which is simpler and avoids needing extlinux + a writable
# bootloader sector.
set -eu

ROOTFS="$1"
OUTDIR="$2"
mkdir -p "${OUTDIR}"

: "${TARGETARCH:?TARGETARCH must be set}"
: "${SOURCE_DATE_EPOCH:?SOURCE_DATE_EPOCH must be set}"

OUT_QCOW="${OUTDIR}/alpine-mows-agent-${TARGETARCH}.qcow2"
OUT_KERNEL="${OUTDIR}/alpine-mows-agent-${TARGETARCH}.vmlinuz"
OUT_INITRD="${OUTDIR}/alpine-mows-agent-${TARGETARCH}.initramfs"

# 1. Pull kernel + initramfs out of the rootfs so the supervisor can pass
#    them to qemu via -kernel / -initrd. The qcow2 then only carries the
#    root filesystem.
KERNEL_FILE=$(ls "${ROOTFS}"/boot/vmlinuz-* 2>/dev/null | head -1 || true)
INITRD_FILE=$(ls "${ROOTFS}"/boot/initramfs-* 2>/dev/null | head -1 || true)
if [ -z "${KERNEL_FILE}" ] || [ -z "${INITRD_FILE}" ]; then
    echo "ERROR: vmlinuz / initramfs missing from ${ROOTFS}/boot" >&2
    exit 1
fi
cp "${KERNEL_FILE}" "${OUT_KERNEL}"
cp "${INITRD_FILE}" "${OUT_INITRD}"

# 2. Estimate disk size + create a sparse raw disk.
SIZE_KB=$(du -sk "${ROOTFS}" | awk '{print $1}')
DISK_KB=$(( SIZE_KB + 524288 ))   # +512MB headroom
RAW="${OUTDIR}/disk.raw"
truncate -s "${DISK_KB}K" "${RAW}"

# 3. Format ext4 *and* populate from rootfs in one shot via -d.
mkfs.ext4 -F -E "lazy_itable_init=1,lazy_journal_init=1" \
    -U "00000000-0000-0000-0000-000000000001" \
    -L "mows-agent-rootfs" \
    -d "${ROOTFS}" \
    "${RAW}" >/dev/null

# 4. Convert raw → compressed qcow2.
qemu-img convert -O qcow2 -c "${RAW}" "${OUT_QCOW}"
rm -f "${RAW}"

# 5. Stamp + sha256 every artifact for the reproducibility contract.
for f in "${OUT_QCOW}" "${OUT_KERNEL}" "${OUT_INITRD}"; do
    touch -hcd "@${SOURCE_DATE_EPOCH}" "${f}"
    sha256sum "${f}" | awk '{print $1}' > "${f}.sha256"
done

echo "wrote ${OUT_QCOW}"
echo "qcow2 sha256:    $(cat ${OUT_QCOW}.sha256)"
echo "kernel sha256:   $(cat ${OUT_KERNEL}.sha256)"
echo "initrd sha256:   $(cat ${OUT_INITRD}.sha256)"
