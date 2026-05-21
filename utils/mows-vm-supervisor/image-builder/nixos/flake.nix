# NixOS VM image for mows-vm-supervisor.
#
# Two variants exposed as flake outputs:
#   nixos-headless: SSH + dockerd + agent toolchain, no display manager
#   nixos-desktop:  same + XFCE
#
# Each variant produces a "bundle" derivation with the raw materials the
# packer stage needs to assemble a rootfs without KVM/QEMU inside the build
# container:
#
#   result/kernel             — extracted vmlinuz (bzImage)
#   result/initrd             — extracted initramfs
#   result/store-paths        — newline-separated list of /nix/store paths
#                                in the system closure (output of closureInfo)
#   result/registration       — nix-path-registration metadata for the closure
#   result/toplevel-path      — single-line file naming the toplevel store
#                                path (so /init symlink can be created later)
#
# The packer stage in `nixos.Dockerfile` consumes this layout, copies every
# listed store path into a staging rootfs, drops the `/init`,
# `/etc/NIXOS`, and `/nix/var/nix/profiles/system` references that NixOS
# expects, then mkfs.ext4 -d's the result into a qcow2 — matching the
# Alpine/Debian/Ubuntu pipeline byte-for-byte.

{
    description = "MOWS agent NixOS images";

    inputs = {
        nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";
    };

    outputs = { self, nixpkgs, ... }:
        let
            system = "x86_64-linux";
            pkgs = import nixpkgs { inherit system; };

            commonModule = { pkgs, lib, modulesPath, ... }: {
                imports = [
                    "${modulesPath}/profiles/qemu-guest.nix"
                    "${modulesPath}/profiles/minimal.nix"
                ];

                fileSystems."/" = {
                    device = "/dev/vda";
                    fsType = "ext4";
                };

                fileSystems."/workspace" = {
                    device = "workspace";
                    fsType = "9p";
                    options = [ "trans=virtio" "version=9p2000.L" "nofail" ];
                };
                fileSystems."/creds" = {
                    device = "creds";
                    fsType = "9p";
                    options = [ "trans=virtio" "version=9p2000.L" "nofail" "ro" ];
                };
                fileSystems."/mowsinit" = {
                    device = "mowsinit";
                    fsType = "9p";
                    options = [ "trans=virtio" "version=9p2000.L" "nofail" "ro" ];
                };

                boot.loader.grub.enable = false;
                boot.loader.systemd-boot.enable = false;
                boot.initrd.systemd.enable = false;
                boot.kernelParams = [ "console=ttyS0,115200" ];

                services.openssh = {
                    enable = true;
                    settings.PermitRootLogin = "prohibit-password";
                    settings.PasswordAuthentication = false;
                };

                virtualisation.docker.enable = true;

                environment.systemPackages = with pkgs; [
                    git curl wget
                    python3
                    nodejs_22
                    pnpm
                    rustup
                    tmux
                    docker-compose
                ];

                systemd.services.mows-agent-init = {
                    description = "MOWS agent init";
                    wantedBy = [ "multi-user.target" ];
                    after = [ "network-online.target" "sshd.service" ];
                    wants = [ "network-online.target" ];
                    serviceConfig = {
                        Type = "oneshot";
                        RemainAfterExit = true;
                        ExecStart = pkgs.writeShellScript "mows-agent-init" ''
                            set -e
                            if [ ! -d /mowsinit ]; then exit 0; fi
                            install -d -m 0700 /root/.ssh
                            if [ -f /mowsinit/authorized_keys ]; then
                                install -m 0600 /mowsinit/authorized_keys \
                                    /root/.ssh/authorized_keys
                            fi
                            if [ -f /mowsinit/run.yaml ]; then
                                kind=$(${pkgs.gawk}/bin/awk -F': *' \
                                    '$1=="kind"{print $2; exit}' /mowsinit/run.yaml)
                                echo "MOWS_AGENT_KIND=''${kind:-claude}" \
                                    >> /etc/environment
                            fi
                            if [ -f /mowsinit/profile.sh ]; then
                                install -m 0644 /mowsinit/profile.sh \
                                    /etc/profile.d/mows-agent.sh
                            fi
                            mkdir -p /run
                            touch /run/mows-agent-init.ready
                        '';
                    };
                };

                services.getty.autologinUser = lib.mkDefault "root";

                system.stateVersion = "25.05";
            };

            desktopModule = { lib, ... }: {
                services.xserver.enable = true;
                services.xserver.displayManager.lightdm.enable = true;
                services.xserver.desktopManager.xfce.enable = true;
                services.displayManager.autoLogin = {
                    enable = true;
                    user = "root";
                };
            };

            mkBundle = modules:
                let
                    nixosCfg = nixpkgs.lib.nixosSystem {
                        inherit system;
                        modules = modules;
                    };
                    toplevel    = nixosCfg.config.system.build.toplevel;
                    kernelDrv   = nixosCfg.config.system.build.kernel;
                    initrdDrv   = nixosCfg.config.system.build.initialRamdisk;
                    closureInfo = pkgs.closureInfo { rootPaths = [ toplevel ]; };
                in pkgs.runCommand "nixos-mows-bundle" {} ''
                    mkdir -p $out
                    cp ${kernelDrv}/bzImage  $out/kernel
                    cp ${initrdDrv}/initrd   $out/initrd
                    cp ${closureInfo}/store-paths   $out/store-paths
                    cp ${closureInfo}/registration  $out/registration
                    echo -n "${toplevel}" > $out/toplevel-path
                '';
        in {
            packages.${system} = {
                nixos-headless = mkBundle [ commonModule ];
                nixos-desktop  = mkBundle [ commonModule desktopModule ];
            };
        };
}
