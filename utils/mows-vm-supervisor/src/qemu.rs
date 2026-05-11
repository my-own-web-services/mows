//! QEMU spawner — pure VM concern (no notion of agent kind).
//!
//! Builds an argv for `qemu-system-x86_64` that boots a VM with:
//! - the cached Alpine qcow2 backing disk (writable overlay per VM)
//! - 9p `workspace` share, read-write, mounted to `/workspace`
//! - 9p `creds` share, read-only, mounted to `/creds` (forwarded
//!   `~/.claude` on the host; agents that need it set `CLAUDE_CONFIG_DIR`)
//! - sshd port-forward `host_ssh_port → guest:22`
//! - dockerd port-forward `host_docker_port → guest:2375`
//! - VNC display bound to a per-VM unix socket (proxied as websocket)
//! - serial console on a chardev unix socket with `logfile=` for persistence
//!
//! Agents (claude, shell, …) are spawned as ssh-launched processes inside
//! a running VM by `agent_runtime`, completely separate from this module.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicU16, Ordering};

use tokio::process::{Child, Command};

use crate::config::{PortRange, SupervisorConfig};
use crate::error::{Result, SupervisorError};

#[derive(Debug, Clone)]
pub struct VmResources {
    pub cpus: u32,
    pub memory_mb: u32,
}

#[derive(Debug, Clone)]
pub struct VmLaunchSpec {
    pub vm_id: String,
    pub vm_name: String,
    pub image_path: PathBuf,
    pub state_dir: PathBuf,
    pub workspace: Option<PathBuf>,
    pub host_ssh_port: u16,
    pub host_docker_port: u16,
    pub resources: VmResources,
    pub authorized_ssh_pubkey: String,
}

#[derive(Debug, Clone)]
pub struct QemuInvocation {
    pub program: String,
    pub args: Vec<String>,
    pub overlay_path: PathBuf,
    pub console_log_path: PathBuf,
    pub display_socket_path: PathBuf,
    pub console_socket_path: PathBuf,
}

impl QemuInvocation {
    pub fn build(cfg: &SupervisorConfig, spec: &VmLaunchSpec) -> Result<Self> {
        let vm_dir = vm_dir_for(&spec.state_dir, &spec.vm_id);
        let overlay_path = vm_dir.join("disk.qcow2");
        let console_log_path = vm_dir.join("console.log");
        let display_socket_path = vm_dir.join("display.sock");
        let console_socket_path = vm_dir.join("console.sock");
        let creds_host_path = std::env::var("MOWS_AGENT_HOST_CREDS_PATH")
            .ok()
            .map(PathBuf::from)
            .or_else(|| {
                let p = PathBuf::from("/host-creds");
                if p.exists() {
                    Some(p)
                } else {
                    None
                }
            })
            .filter(|p| p.exists());

        let arch = std::env::consts::ARCH;
        let arch_name = match arch {
            "x86_64" => "amd64",
            "aarch64" => "arm64",
            other => other,
        };
        let kernel_path = cfg
            .image_dir
            .join(format!("alpine-mows-agent-{arch_name}.vmlinuz"));
        let initrd_path = cfg
            .image_dir
            .join(format!("alpine-mows-agent-{arch_name}.initramfs"));
        let mut args: Vec<String> = vec![
            "-machine".to_string(),
            "type=q35,accel=kvm".to_string(),
            "-cpu".to_string(),
            "host".to_string(),
            "-smp".to_string(),
            spec.resources.cpus.to_string(),
            "-m".to_string(),
            format!("{}M", spec.resources.memory_mb),
            "-display".to_string(),
            "none".to_string(),
            "-vnc".to_string(),
            format!("unix:{}", display_socket_path.display()),
            "-chardev".to_string(),
            format!(
                "socket,id=ser0,path={},server=on,wait=off,logfile={},logappend=on",
                console_socket_path.display(),
                console_log_path.display()
            ),
            "-serial".to_string(),
            "chardev:ser0".to_string(),
            "-drive".to_string(),
            format!(
                "file={},if=virtio,cache=none,format=qcow2,discard=unmap",
                overlay_path.display()
            ),
        ];
        if kernel_path.exists() {
            args.extend([
                "-kernel".to_string(),
                kernel_path.display().to_string(),
            ]);
            if initrd_path.exists() {
                args.extend([
                    "-initrd".to_string(),
                    initrd_path.display().to_string(),
                ]);
            }
            args.extend([
                "-append".to_string(),
                "root=/dev/vda rw rootfstype=ext4 console=ttyS0,115200 ip=dhcp".to_string(),
            ]);
        }
        args.extend([
            "-netdev".to_string(),
            format!(
                "user,id=net0,hostfwd=tcp:127.0.0.1:{}-:22,hostfwd=tcp:127.0.0.1:{}-:2375",
                spec.host_ssh_port, spec.host_docker_port
            ),
            "-device".to_string(),
            "virtio-net-pci,netdev=net0".to_string(),
            "-no-reboot".to_string(),
        ]);

        if let Some(ws) = &spec.workspace {
            args.extend([
                "-fsdev".to_string(),
                format!(
                    "local,id=ws,path={},security_model=mapped-xattr",
                    ws.display()
                ),
                "-device".to_string(),
                "virtio-9p-pci,fsdev=ws,mount_tag=workspace".to_string(),
            ]);
        }

        if let Some(creds) = &creds_host_path {
            args.extend([
                "-fsdev".to_string(),
                format!(
                    "local,id=creds,path={},security_model=mapped-xattr,readonly=on",
                    creds.display()
                ),
                "-device".to_string(),
                "virtio-9p-pci,fsdev=creds,mount_tag=creds".to_string(),
            ]);
        }

        // The vminit 9p share carries the per-VM run.yaml + authorized_keys.
        args.extend([
            "-fsdev".to_string(),
            format!(
                "local,id=init,path={},security_model=mapped-xattr,readonly=on",
                vm_dir.display()
            ),
            "-device".to_string(),
            "virtio-9p-pci,fsdev=init,mount_tag=mowsinit".to_string(),
        ]);

        Ok(Self {
            program: cfg.qemu_binary.clone(),
            args,
            overlay_path,
            console_log_path,
            display_socket_path,
            console_socket_path,
        })
    }
}

pub fn vm_dir_for(state_dir: &Path, vm_id: &str) -> PathBuf {
    state_dir.join("vms").join(vm_id)
}

pub fn display_socket_for(state_dir: &Path, vm_id: &str) -> PathBuf {
    vm_dir_for(state_dir, vm_id).join("display.sock")
}

pub fn console_socket_for(state_dir: &Path, vm_id: &str) -> PathBuf {
    vm_dir_for(state_dir, vm_id).join("console.sock")
}

/// In-guest config; `mows-agent-init` (an OpenRC service in the image) reads
/// this from the `mowsinit` 9p mount on boot. The VM no longer auto-launches
/// any specific agent — that's done explicitly via `agent_runtime` once the
/// supervisor is told to spawn one.
#[derive(Debug, serde::Serialize)]
pub struct GuestVmConfig {
    pub vm_id: String,
    pub vm_name: String,
    pub authorized_ssh_pubkey: String,
}

impl GuestVmConfig {
    pub fn from_spec(spec: &VmLaunchSpec) -> Self {
        Self {
            vm_id: spec.vm_id.clone(),
            vm_name: spec.vm_name.clone(),
            authorized_ssh_pubkey: spec.authorized_ssh_pubkey.clone(),
        }
    }
}

/// Prepare per-VM state directory: writes the run.yaml seed and creates a
/// fresh qcow2 overlay over the cached image. Idempotent.
pub async fn prepare_vm_dir(cfg: &SupervisorConfig, spec: &VmLaunchSpec) -> Result<()> {
    let vm_dir = vm_dir_for(&spec.state_dir, &spec.vm_id);
    tokio::fs::create_dir_all(&vm_dir).await?;

    let guest = GuestVmConfig::from_spec(spec);
    let yaml = serde_yaml_neo::to_string(&guest)?;
    tokio::fs::write(vm_dir.join("run.yaml"), yaml).await?;

    tokio::fs::write(
        vm_dir.join("authorized_keys"),
        format!("{}\n", spec.authorized_ssh_pubkey),
    )
    .await?;

    let overlay = vm_dir.join("disk.qcow2");
    if !overlay.exists() {
        let status = Command::new("qemu-img")
            .arg("create")
            .arg("-q")
            .arg("-f")
            .arg("qcow2")
            .arg("-F")
            .arg("qcow2")
            .arg("-b")
            .arg(&spec.image_path)
            .arg(&overlay)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .status()
            .await
            .map_err(|e| {
                SupervisorError::QemuSpawn(format!("failed to exec qemu-img: {e}"))
            })?;
        if !status.success() {
            return Err(SupervisorError::QemuSpawn(format!(
                "qemu-img create exited with {status}"
            )));
        }
    }
    let _ = cfg;
    Ok(())
}

/// Locate the cached qcow2 in `image_dir`. v1 keeps a single image per arch.
pub fn locate_image(cfg: &SupervisorConfig) -> Result<PathBuf> {
    let arch = std::env::consts::ARCH;
    let arch_name = match arch {
        "x86_64" => "amd64",
        "aarch64" => "arm64",
        other => other,
    };
    let candidate = cfg
        .image_dir
        .join(format!("alpine-mows-agent-{arch_name}.qcow2"));
    if !candidate.exists() {
        return Err(SupervisorError::ImageMissing(format!(
            "expected qcow2 at {} — run `mows vms build-image`",
            candidate.display()
        )));
    }
    Ok(candidate)
}

/// Allocates host loopback ports out of the configured range.
pub struct PortAllocator {
    range: PortRange,
    next: AtomicU16,
}

impl PortAllocator {
    pub fn new(range: PortRange) -> Self {
        let start = range.start;
        Self {
            range,
            next: AtomicU16::new(start),
        }
    }

    pub fn allocate_pair(&self) -> Result<(u16, u16)> {
        let ssh = self.advance()?;
        let docker = self.advance()?;
        Ok((ssh, docker))
    }

    fn advance(&self) -> Result<u16> {
        let port = self.next.fetch_add(1, Ordering::SeqCst);
        if port > self.range.end {
            self.next.store(self.range.start, Ordering::SeqCst);
            return Err(SupervisorError::Internal(
                "port range exhausted; widen port_range in config".to_string(),
            ));
        }
        Ok(port)
    }
}

#[derive(Default)]
pub struct VmRegistry {
    children: HashMap<String, Child>,
}

impl VmRegistry {
    pub fn insert(&mut self, vm_id: String, child: Child) {
        self.children.insert(vm_id, child);
    }

    pub fn remove(&mut self, vm_id: &str) -> Option<Child> {
        self.children.remove(vm_id)
    }

    pub fn contains(&self, vm_id: &str) -> bool {
        self.children.contains_key(vm_id)
    }

    pub fn pid(&self, vm_id: &str) -> Option<u32> {
        self.children.get(vm_id).and_then(Child::id)
    }
}

pub fn check_kvm_available() -> Result<()> {
    let kvm = Path::new("/dev/kvm");
    if !kvm.exists() {
        return Err(SupervisorError::KvmUnavailable(
            "/dev/kvm not present (is the kvm kernel module loaded? is the container privileged?)"
                .to_string(),
        ));
    }
    let _ = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open(kvm)
        .map_err(|e| {
            SupervisorError::KvmUnavailable(format!("cannot open /dev/kvm: {e}"))
        })?;
    Ok(())
}

pub async fn spawn_qemu(invocation: &QemuInvocation) -> Result<Child> {
    // Persist QEMU stderr to a per-VM file. The supervisor itself doesn't
    // read the pipe, so a piped stderr would silently fill the kernel pipe
    // buffer (~64 KiB) and stall QEMU; worse, when QEMU dies early we'd
    // have no diagnostic. The file lives next to console.log.
    let stderr_path = invocation.console_log_path.with_file_name("qemu.stderr.log");
    let stderr_file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&stderr_path)
        .map_err(|e| {
            SupervisorError::QemuSpawn(format!(
                "failed to open qemu stderr log {}: {e}",
                stderr_path.display()
            ))
        })?;
    Command::new(&invocation.program)
        .args(&invocation.args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::from(stderr_file))
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| SupervisorError::QemuSpawn(format!("failed to exec qemu: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_spec() -> VmLaunchSpec {
        VmLaunchSpec {
            vm_id: "id-123".into(),
            vm_name: "demo".into(),
            image_path: PathBuf::from("/var/lib/mows-agent/images/alpine.qcow2"),
            state_dir: PathBuf::from("/tmp/mows-agent-test"),
            workspace: Some(PathBuf::from("/home/x/proj")),
            host_ssh_port: 22001,
            host_docker_port: 22501,
            resources: VmResources { cpus: 2, memory_mb: 2048 },
            authorized_ssh_pubkey: "ssh-ed25519 AAAA test".into(),
        }
    }

    #[test]
    fn invocation_includes_kvm_and_serial() {
        let cfg = SupervisorConfig::defaults_for_tests();
        let inv = QemuInvocation::build(&cfg, &test_spec()).unwrap();
        let joined = inv.args.join(" ");
        assert!(joined.contains("accel=kvm"));
        assert!(!joined.contains("-nographic"));
        assert!(joined.contains("-display none"));
        assert!(joined.contains("chardev:ser0"));
        assert!(joined.contains("logfile=/tmp/mows-agent-test/vms/id-123/console.log"));
        assert!(joined.contains("logappend=on"));
    }

    #[test]
    fn invocation_binds_vnc_unix_socket() {
        let cfg = SupervisorConfig::defaults_for_tests();
        let inv = QemuInvocation::build(&cfg, &test_spec()).unwrap();
        let joined = inv.args.join(" ");
        assert!(joined.contains("-vnc unix:/tmp/mows-agent-test/vms/id-123/display.sock"));
        assert_eq!(
            display_socket_for(&PathBuf::from("/tmp/mows-agent-test"), "id-123"),
            inv.display_socket_path,
        );
    }

    #[test]
    fn invocation_binds_console_unix_socket() {
        let cfg = SupervisorConfig::defaults_for_tests();
        let inv = QemuInvocation::build(&cfg, &test_spec()).unwrap();
        let joined = inv.args.join(" ");
        assert!(joined.contains("path=/tmp/mows-agent-test/vms/id-123/console.sock"));
        assert!(joined.contains("server=on,wait=off"));
        assert_eq!(
            console_socket_for(&PathBuf::from("/tmp/mows-agent-test"), "id-123"),
            inv.console_socket_path,
        );
    }

    #[test]
    fn invocation_includes_port_forwards() {
        let cfg = SupervisorConfig::defaults_for_tests();
        let inv = QemuInvocation::build(&cfg, &test_spec()).unwrap();
        let joined = inv.args.join(" ");
        assert!(joined.contains("hostfwd=tcp:127.0.0.1:22001-:22"));
        assert!(joined.contains("hostfwd=tcp:127.0.0.1:22501-:2375"));
    }

    #[test]
    fn invocation_omits_workspace_when_absent() {
        let cfg = SupervisorConfig::defaults_for_tests();
        let mut spec = test_spec();
        spec.workspace = None;
        let inv = QemuInvocation::build(&cfg, &spec).unwrap();
        let joined = inv.args.join(" ");
        assert!(!joined.contains("mount_tag=workspace"));
        assert!(joined.contains("mount_tag=mowsinit"));
    }

    #[test]
    fn port_allocator_returns_distinct_pairs() {
        let alloc = PortAllocator::new(PortRange { start: 22000, end: 22010 });
        let (a, b) = alloc.allocate_pair().unwrap();
        let (c, d) = alloc.allocate_pair().unwrap();
        assert_ne!(a, b);
        assert_ne!(c, d);
        assert_ne!(a, c);
    }

    #[test]
    fn port_allocator_errors_when_exhausted() {
        let alloc = PortAllocator::new(PortRange { start: 22000, end: 22001 });
        let _ = alloc.allocate_pair().unwrap();
        let result = alloc.allocate_pair();
        assert!(result.is_err());
    }
}
