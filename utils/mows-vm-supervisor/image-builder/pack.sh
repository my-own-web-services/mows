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
#   DISTRO              — alpine | debian | ubuntu | nixos (output naming)
#   FLAVOR              — headless | desktop (output naming)
#
# Output (one per artifact, plus a .sha256 sibling):
#   $2/<DISTRO>-mows-agent-${TARGETARCH}.qcow2
#   $2/<DISTRO>-mows-agent-${TARGETARCH}.vmlinuz
#   $2/<DISTRO>-mows-agent-${TARGETARCH}.initramfs
#
# `build.sh` renames these to the full `<DISTRO>-<FLAVOR>-mows-agent-<arch>`
# scheme afterwards. We use the shorter name inside the build step so the
# kernel/initrd lookup logic doesn't need to know about flavors (the rootfs
# itself differs by flavor; the kernel/initrd is the same per distro).
#
# Implementation note: this runs inside `docker buildx`, so loop devices and
# kernel mounts are unavailable. We use `mkfs.ext4 -d` to populate the
# filesystem directly from `${ROOTFS}` and skip the bootloader + initramfs
# entirely — the supervisor boots the VM via QEMU's `-kernel` / `-initrd`
# instead, which is simpler and avoids needing extlinux + a writable
# bootloader sector.
set -euo pipefail

ROOTFS="$1"
OUTDIR="$2"
mkdir -p "${OUTDIR}"

: "${TARGETARCH:?TARGETARCH must be set}"
: "${SOURCE_DATE_EPOCH:?SOURCE_DATE_EPOCH must be set}"
: "${DISTRO:?DISTRO must be set}"

PREFIX="${DISTRO}-mows-agent-${TARGETARCH}"
OUT_QCOW="${OUTDIR}/${PREFIX}.qcow2"
OUT_KERNEL="${OUTDIR}/${PREFIX}.vmlinuz"
OUT_INITRD="${OUTDIR}/${PREFIX}.initramfs"

# 1. Pull kernel + initramfs out of the rootfs so the supervisor can pass
#    them to qemu via -kernel / -initrd. The qcow2 then only carries the
#    root filesystem.
#
# Different distros use different filenames in /boot:
#   alpine:    vmlinuz-virt          + initramfs-virt
#   debian:    vmlinuz-<ver>-amd64   + initrd.img-<ver>-amd64
#   ubuntu:    vmlinuz-<ver>-generic + initrd.img-<ver>-generic
# `-v` sorts vmlinuz-6.10 < vmlinuz-6.11 numerically (lexical sort gets
# this wrong, picking 6.10 on some debian-trixie boxes); `tail -1` then
# takes the newest installed kernel rather than the lexically-first
# (DEVOPS-34). `|| true` suppresses the non-zero exit when no match
# exists; the `if [ -z … ]` below produces the actionable error.
KERNEL_FILE=$(ls -1v "${ROOTFS}"/boot/vmlinuz-* 2>/dev/null | tail -1 || true)
INITRD_FILE=$(ls -1v "${ROOTFS}"/boot/initramfs-* "${ROOTFS}"/boot/initrd.img-* 2>/dev/null | tail -1 || true)
if [ -z "${KERNEL_FILE}" ] || [ -z "${INITRD_FILE}" ]; then
    echo "ERROR: vmlinuz / initramfs missing from ${ROOTFS}/boot" >&2
    ls -la "${ROOTFS}/boot" >&2 || true
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
# `lazy_itable_init=0,lazy_journal_init=0` forces inode/journal init at
# mkfs time so the disk image doesn't get modified on first mount inside
# the VM (DEVOPS-31). Slower mkfs, but `qemu-img convert` produces a
# stable result this way.
mkfs.ext4 -F -E "lazy_itable_init=0,lazy_journal_init=0" \
    -U "00000000-0000-0000-0000-000000000001" \
    -L "mows-agent-rootfs" \
    -d "${ROOTFS}" \
    "${RAW}" >/dev/null

# 4. Convert raw → compressed qcow2. `compat=0.10` uses the simpler
# qcow2 header that doesn't embed an extension block with a per-build
# `creation_time` field (DEVOPS-32 — recent qemu-img versions
# silently broke sha256 reproducibility without it).
qemu-img convert -O qcow2 -c -o compat=0.10 "${RAW}" "${OUT_QCOW}"
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
