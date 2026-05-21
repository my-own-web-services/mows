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

use tokio::process::{Child, Command};

use crate::config::{PortRange, SupervisorConfig};
use crate::error::{Result, SupervisorError};

#[derive(Debug, Clone)]
pub struct VmResources {
    pub cpus: u32,
    pub memory_mb: u32,
}

/// Resolve a user-supplied workspace path to a safe, canonical absolute
/// `PathBuf` that's safe to interpolate into a QEMU `-fsdev local,path=…`
/// argument.
///
/// QEMU parses `-fsdev` as a comma-separated key=value list, so a path
/// containing `,` would let the caller smuggle in extra options (e.g.
/// `,security_model=passthrough`). Symlinks and `..` segments would also
/// let the caller escape any intended workspace root. We canonicalize the
/// path (resolving symlinks and traversals), require it to be an existing
/// directory, and reject any embedded comma or newline.
pub fn validate_workspace_path(raw: &str) -> Result<PathBuf> {
    if raw.is_empty() {
        return Err(SupervisorError::BadRequest(
            "workspace path must not be empty".into(),
        ));
    }
    let path = std::path::Path::new(raw);
    if !path.is_absolute() {
        return Err(SupervisorError::BadRequest(format!(
            "workspace path must be absolute, got {raw:?}"
        )));
    }
    let canonical = std::fs::canonicalize(path).map_err(|e| {
        SupervisorError::BadRequest(format!(
            "workspace path {raw:?} could not be resolved: {e}"
        ))
    })?;
    if !canonical.is_dir() {
        return Err(SupervisorError::BadRequest(format!(
            "workspace path {} is not a directory",
            canonical.display()
        )));
    }
    let canonical_str = canonical.to_str().ok_or_else(|| {
        SupervisorError::BadRequest(format!(
            "workspace path {} is not valid UTF-8",
            canonical.display()
        ))
    })?;
    if canonical_str.contains(',') || canonical_str.contains('\n') {
        return Err(SupervisorError::BadRequest(format!(
            "workspace path {canonical_str:?} contains comma or newline, which \
             would break QEMU -fsdev argument parsing"
        )));
    }
    Ok(canonical)
}

/// Matches `api::vms::VmDisplayMode`; duplicated here to keep the qemu
/// module independent of the API layer's serde derivations.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum DisplayMode {
    #[default]
    Headless,
    Desktop,
}

#[derive(Debug, Clone)]
pub struct VmLaunchSpec {
    pub vm_id: String,
    pub vm_name: String,
    /// Backing qcow2. The image-builder writes one per (distro, flavor).
    pub image_path: PathBuf,
    /// Kernel + initramfs extracted from the same rootfs as `image_path`.
    /// The supervisor boots via `-kernel`/`-initrd` so the qcow2 doesn't
    /// need its own bootloader.
    pub kernel_path: PathBuf,
    pub initrd_path: PathBuf,
    pub state_dir: PathBuf,
    pub workspace: Option<PathBuf>,
    pub host_ssh_port: u16,
    pub host_docker_port: u16,
    pub resources: VmResources,
    pub authorized_ssh_pubkey: String,
    /// `headless` (default) emits `-display none`; `desktop` emits a virtio
    /// GPU plus serial console for VNC access via the per-VM display socket.
    pub display_mode: DisplayMode,
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
        // Resolved at startup in `SupervisorConfig::load`; reading the env
        // here on every VM spawn would violate the "all env vars upfront"
        // rule and is also racy with `std::env::set_var`.
        let creds_host_path = cfg.agent_host_creds_path.clone();

        // Borrow the spec's PathBufs directly — `spec` is already borrowed
        // for the lifetime of `build`, so the clones (TECH-RUST-16) were
        // gratuitous.
        let kernel_path = &spec.kernel_path;
        let initrd_path = &spec.initrd_path;
        let display_args: Vec<String> = match spec.display_mode {
            DisplayMode::Headless => vec!["-display".to_string(), "none".to_string()],
            DisplayMode::Desktop => vec![
                "-display".to_string(),
                "none".to_string(),
                "-device".to_string(),
                "virtio-vga-gl".to_string(),
            ],
        };
        let mut args: Vec<String> = vec![
            "-machine".to_string(),
            "type=q35,accel=kvm".to_string(),
            "-cpu".to_string(),
            "host".to_string(),
            "-smp".to_string(),
            spec.resources.cpus.to_string(),
            "-m".to_string(),
            format!("{}M", spec.resources.memory_mb),
        ];
        args.extend(display_args);
        args.extend([
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
        ]);
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
pub async fn prepare_vm_dir(spec: &VmLaunchSpec) -> Result<()> {
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
        // SLOP-48: store the backing reference as a path relative to the
        // overlay's directory when possible. The absolute path would bake
        // the supervisor's current state_dir into the qcow2 header and
        // break the next boot if state_dir is renamed or the layout is
        // copied to another host. `qemu-img create -b` resolves the
        // backing path against the *overlay's* directory, so a relative
        // form survives directory renames as long as image_dir and
        // state_dir move together. Falls back to absolute when the two
        // paths don't share enough of a common prefix (different mounts,
        // etc.).
        let backing_arg: std::ffi::OsString =
            relative_backing_path(&overlay, &spec.image_path)
                .map(Into::into)
                .unwrap_or_else(|| spec.image_path.clone().into_os_string());

        let status = Command::new("qemu-img")
            .arg("create")
            .arg("-q")
            .arg("-f")
            .arg("qcow2")
            .arg("-F")
            .arg("qcow2")
            .arg("-b")
            .arg(&backing_arg)
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
    Ok(())
}

/// Compute the backing-image path relative to the overlay's directory.
/// Returns `None` when the two paths don't share a common prefix (e.g.
/// different mount points) — caller should fall back to the absolute
/// path in that case.
fn relative_backing_path(overlay: &Path, image: &Path) -> Option<PathBuf> {
    let overlay_dir = overlay.parent()?;
    let overlay_dir = overlay_dir.canonicalize().ok()?;
    let image_canonical = image.canonicalize().ok()?;

    let mut up_components = Vec::new();
    let mut anchor: &Path = &overlay_dir;
    loop {
        if let Ok(rel) = image_canonical.strip_prefix(anchor) {
            let mut path = PathBuf::new();
            for _ in &up_components {
                path.push("..");
            }
            path.push(rel);
            return Some(path);
        }
        anchor = match anchor.parent() {
            Some(parent) => {
                up_components.push(());
                parent
            }
            None => return None,
        };
    }
}

/// Resolve the qcow2 + kernel + initramfs paths for a (distro, flavor)
/// combination. Each image-builder variant lands as
/// `<distro>-<flavor>-mows-agent-<arch>.{qcow2,vmlinuz,initramfs}`.
pub struct ImageArtifacts {
    pub qcow2: PathBuf,
    pub kernel: PathBuf,
    pub initramfs: PathBuf,
}

pub fn locate_image(
    cfg: &SupervisorConfig,
    distro: &str,
    flavor: &str,
) -> Result<ImageArtifacts> {
    let arch = std::env::consts::ARCH;
    let arch_name = match arch {
        "x86_64" => "amd64",
        "aarch64" => "arm64",
        other => other,
    };
    let prefix = format!("{distro}-{flavor}-mows-agent-{arch_name}");
    let qcow2 = cfg.image_dir.join(format!("{prefix}.qcow2"));
    let kernel = cfg.image_dir.join(format!("{prefix}.vmlinuz"));
    let initramfs = cfg.image_dir.join(format!("{prefix}.initramfs"));
    if !qcow2.exists() {
        return Err(SupervisorError::ImageMissing(format!(
            "expected qcow2 at {} — run `bash image-builder/build.sh --distro {distro} --flavor {flavor}`",
            qcow2.display()
        )));
    }
    // TECH-RUST-11: catch the half-built case where the qcow2 exists but
    // exactly one of `.vmlinuz` / `.initramfs` is missing — that's almost
    // always an interrupted image-builder run, and silently booting
    // without `-kernel`/`-initrd` would just hang. The e2e stub case
    // ships NEITHER (so both `.exists()` are false), which we accept on
    // purpose — `QemuInvocation::build` skips the `-kernel` flag and
    // QEMU's BIOS path takes over, which the stub tests rely on.
    let kernel_present = kernel.exists();
    let initrd_present = initramfs.exists();
    if kernel_present != initrd_present {
        return Err(SupervisorError::ImageMissing(format!(
            "half-built image set for {distro}-{flavor}-{arch_name}: \
             kernel present={kernel_present}, initramfs present={initrd_present}. \
             Re-run `bash image-builder/build.sh --distro {distro} --flavor {flavor}`"
        )));
    }
    Ok(ImageArtifacts {
        qcow2,
        kernel,
        initramfs,
    })
}

/// Allocates host loopback ports out of the configured range.
///
/// Allocations are tracked in an in-memory `BTreeSet` so that ports freed
/// by `release()` can be reused, and so that the supervisor can rebuild the
/// allocator state from the DB on startup (see `from_db_state`). Without
/// the in-memory reservation set the allocator would either (a) hand out
/// a port already bound by a surviving QEMU process after restart, or
/// (b) leak the range as VMs are stopped and the `next` counter only
/// climbs.
pub struct PortAllocator {
    range: PortRange,
    inner: std::sync::Mutex<PortAllocatorInner>,
}

struct PortAllocatorInner {
    in_use: std::collections::BTreeSet<u16>,
    cursor: u16,
}

impl PortAllocator {
    pub fn new(range: PortRange) -> Self {
        let start = range.start;
        Self {
            range,
            inner: std::sync::Mutex::new(PortAllocatorInner {
                in_use: std::collections::BTreeSet::new(),
                cursor: start,
            }),
        }
    }

    /// Rebuild allocator state from a set of currently-occupied ports
    /// (typically loaded from the `vms` table at startup). Any port within
    /// the configured range that's already in use is reserved.
    pub fn with_reservations(range: PortRange, reservations: impl IntoIterator<Item = u16>) -> Self {
        let allocator = Self::new(range.clone());
        {
            let mut inner = allocator.inner.lock().expect("port allocator mutex poisoned");
            for port in reservations {
                if port >= range.start && port <= range.end {
                    inner.in_use.insert(port);
                }
            }
        }
        allocator
    }

    pub fn allocate_pair(&self) -> Result<(u16, u16)> {
        let mut inner = self.inner.lock().expect("port allocator mutex poisoned");
        let ssh = self.next_free(&mut inner)?;
        inner.in_use.insert(ssh);
        let docker = self.next_free(&mut inner)?;
        inner.in_use.insert(docker);
        Ok((ssh, docker))
    }

    /// Release a previously-allocated port so a future `allocate_pair()`
    /// can hand it out again. Called from `stop_vm` / `delete_vm`.
    pub fn release(&self, ports: impl IntoIterator<Item = u16>) {
        let mut inner = self.inner.lock().expect("port allocator mutex poisoned");
        for port in ports {
            inner.in_use.remove(&port);
        }
    }

    fn next_free(&self, inner: &mut PortAllocatorInner) -> Result<u16> {
        let span = self.range.end - self.range.start + 1;
        for _ in 0..span {
            let candidate = inner.cursor;
            inner.cursor = if candidate >= self.range.end {
                self.range.start
            } else {
                candidate + 1
            };
            if !inner.in_use.contains(&candidate) {
                return Ok(candidate);
            }
        }
        Err(SupervisorError::PortExhausted(
            "widen port_range in config".to_string(),
        ))
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
            kernel_path: PathBuf::from("/var/lib/mows-agent/images/alpine.vmlinuz"),
            initrd_path: PathBuf::from("/var/lib/mows-agent/images/alpine.initramfs"),
            state_dir: PathBuf::from("/tmp/mows-agent-test"),
            workspace: Some(PathBuf::from("/home/x/proj")),
            host_ssh_port: 22001,
            host_docker_port: 22501,
            resources: VmResources { cpus: 2, memory_mb: 2048 },
            authorized_ssh_pubkey: "ssh-ed25519 AAAA test".into(),
            display_mode: DisplayMode::Headless,
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
    fn invocation_desktop_mode_adds_virtio_vga() {
        let cfg = SupervisorConfig::defaults_for_tests();
        let mut spec = test_spec();
        spec.display_mode = DisplayMode::Desktop;
        let inv = QemuInvocation::build(&cfg, &spec).unwrap();
        let joined = inv.args.join(" ");
        assert!(
            joined.contains("virtio-vga-gl"),
            "desktop mode must wire a virtio GPU; got: {joined}"
        );
    }

    #[test]
    fn invocation_headless_mode_skips_gpu() {
        let cfg = SupervisorConfig::defaults_for_tests();
        let inv = QemuInvocation::build(&cfg, &test_spec()).unwrap();
        let joined = inv.args.join(" ");
        assert!(
            !joined.contains("virtio-vga"),
            "headless mode must NOT add a GPU; got: {joined}"
        );
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

    #[test]
    fn port_allocator_release_reuses_freed_ports() {
        let alloc = PortAllocator::new(PortRange { start: 22000, end: 22003 });
        let (a, b) = alloc.allocate_pair().unwrap();
        assert!(alloc.allocate_pair().is_ok());
        // Range exhausted at this point.
        assert!(alloc.allocate_pair().is_err());
        // Free the first pair and confirm we can allocate them again.
        alloc.release([a, b]);
        let (c, d) = alloc.allocate_pair().unwrap();
        // We may not get back the exact same ports because the cursor has
        // already advanced, but both must come from the released set.
        let released: std::collections::BTreeSet<u16> = [a, b].into_iter().collect();
        assert!(released.contains(&c));
        assert!(released.contains(&d));
    }

    #[test]
    fn port_allocator_with_reservations_avoids_collision() {
        let range = PortRange { start: 22000, end: 22003 };
        let alloc = PortAllocator::with_reservations(range, [22000, 22001]);
        // 22000 / 22001 are reserved; the next free pair must be 22002 / 22003.
        let (a, b) = alloc.allocate_pair().unwrap();
        assert_eq!(a, 22002);
        assert_eq!(b, 22003);
        // Range exhausted.
        assert!(alloc.allocate_pair().is_err());
    }

    #[test]
    fn validate_workspace_rejects_relative_paths() {
        assert!(matches!(
            validate_workspace_path("rel/path"),
            Err(SupervisorError::BadRequest(_))
        ));
        assert!(matches!(
            validate_workspace_path(""),
            Err(SupervisorError::BadRequest(_))
        ));
    }

    #[test]
    fn validate_workspace_rejects_missing_paths() {
        assert!(matches!(
            validate_workspace_path("/absolutely/does/not/exist/0e1c"),
            Err(SupervisorError::BadRequest(_))
        ));
    }

    #[test]
    fn validate_workspace_rejects_comma_in_canonical_path() {
        let tmp = tempfile::tempdir().unwrap();
        let evil = tmp.path().join("with,comma");
        std::fs::create_dir(&evil).unwrap();
        let raw = evil.to_string_lossy().to_string();
        let err = validate_workspace_path(&raw).unwrap_err();
        match err {
            SupervisorError::BadRequest(msg) => assert!(msg.contains("comma")),
            other => panic!("expected BadRequest, got {other:?}"),
        }
    }

    #[test]
    fn validate_workspace_accepts_clean_directory() {
        let tmp = tempfile::tempdir().unwrap();
        let raw = tmp.path().to_string_lossy().to_string();
        let canonical = validate_workspace_path(&raw).unwrap();
        assert!(canonical.is_dir());
    }
}
