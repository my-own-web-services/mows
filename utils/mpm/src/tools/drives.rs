use std::io::{self, IsTerminal};
use std::process::Command;

use comfy_table::{presets::UTF8_FULL_CONDENSED, Attribute, Cell, Color, ContentArrangement, Table};
use serde::Deserialize;
use tracing::debug;

/// Result of SMART health check
#[derive(Debug, Clone)]
enum SmartResult {
    Passed,
    Failed,
    Unknown(String),
    NotInstalled,
    PermissionDenied,
}

/// lsblk JSON output structures
#[derive(Deserialize)]
struct LsblkOutput {
    blockdevices: Vec<BlockDevice>,
}

#[derive(Deserialize, Clone)]
struct BlockDevice {
    name: String,
    size: Option<String>,
    #[serde(rename = "type")]
    device_type: Option<String>,
    fstype: Option<String>,
    mountpoint: Option<String>,
    #[serde(rename = "fsuse%")]
    fsuse_percent: Option<String>,
    model: Option<String>,
    #[serde(default)]
    children: Vec<BlockDevice>,
}

/// smartctl JSON output structures
#[derive(Deserialize)]
struct SmartctlOutput {
    smartctl: SmartctlInfo,
    #[serde(default)]
    smart_status: Option<SmartStatus>,
}

#[derive(Deserialize)]
struct SmartctlInfo {
    #[serde(default)]
    messages: Vec<SmartctlMessage>,
}

#[derive(Deserialize)]
struct SmartctlMessage {
    string: String,
    severity: String,
}

#[derive(Deserialize)]
struct SmartStatus {
    passed: bool,
}

/// Get SMART health status for a device using JSON output
fn get_smart_health(device: &str) -> SmartResult {
    let output = Command::new("smartctl")
        .args(["-H", "--json", &format!("/dev/{}", device)])
        .output();

    match output {
        Err(_) => SmartResult::NotInstalled,
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            let parsed: Result<SmartctlOutput, _> = serde_json::from_str(&stdout);

            match parsed {
                Ok(data) => {
                    for msg in &data.smartctl.messages {
                        if msg.severity == "error" {
                            if msg.string.contains("Permission denied")
                                || msg.string.contains("Operation not permitted")
                            {
                                return SmartResult::PermissionDenied;
                            }
                            if msg.string.contains("not support SMART")
                                || msg.string.contains("Unknown USB bridge")
                            {
                                return SmartResult::Unknown("n/a".to_string());
                            }
                        }
                    }

                    if let Some(status) = data.smart_status {
                        if status.passed {
                            SmartResult::Passed
                        } else {
                            SmartResult::Failed
                        }
                    } else {
                        SmartResult::Unknown("n/a".to_string())
                    }
                }
                Err(_) => {
                    if stdout.contains("Permission denied") {
                        SmartResult::PermissionDenied
                    } else {
                        SmartResult::Unknown("n/a".to_string())
                    }
                }
            }
        }
    }
}

/// Get block devices using lsblk
fn get_block_devices() -> Result<Vec<BlockDevice>, String> {
    let output = Command::new("lsblk")
        .args(["--json", "-o", "NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT,FSUSE%,MODEL"])
        .output()
        .map_err(|e| format!("Failed to run lsblk: {}", e))?;

    if !output.status.success() {
        return Err("lsblk command failed".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let parsed: LsblkOutput =
        serde_json::from_str(&stdout).map_err(|e| format!("Failed to parse lsblk output: {}", e))?;

    let disks: Vec<BlockDevice> = parsed
        .blockdevices
        .into_iter()
        .filter(|d| {
            let name = &d.name;
            let is_disk = d.device_type.as_deref() == Some("disk");
            let is_virtual = name.starts_with("loop")
                || name.starts_with("ram")
                || name.starts_with("zram")
                || name.starts_with("sr")
                || name.starts_with("fd");
            is_disk && !is_virtual
        })
        .collect();

    Ok(disks)
}

/// Check if a child device should be skipped (Docker volumes, etc.)
fn is_skip_child(device: &BlockDevice) -> bool {
    let name = &device.name;

    if name.starts_with("docker-") || name.starts_with("loop") || name.starts_with("ram") {
        return true;
    }

    if let Some(mount) = &device.mountpoint {
        if mount.contains("/docker/") || mount.contains("/containers/") {
            return true;
        }
    }

    false
}

/// Add rows for children recursively
fn add_children_rows(
    table: &mut Table,
    children: &[BlockDevice],
    depth: usize,
    use_colors: bool,
) {
    let visible: Vec<_> = children.iter().filter(|c| !is_skip_child(c)).collect();
    let len = visible.len();

    for (i, child) in visible.iter().enumerate() {
        let is_last = i == len - 1;
        let prefix = if is_last { "└─ " } else { "├─ " };
        let indent = "  ".repeat(depth.saturating_sub(1));
        let name = format!("{}{}{}", indent, prefix, child.name);

        let size = child.size.as_deref().unwrap_or("-");
        let fstype = child.fstype.as_deref().unwrap_or("-");
        let mount = child.mountpoint.as_deref().unwrap_or("-");
        let usage = child.fsuse_percent.as_deref().unwrap_or("-");

        // Create cells with appropriate colors
        let name_cell = Cell::new(&name);

        let mount_cell = if child.mountpoint.is_some() && use_colors {
            Cell::new(mount).fg(Color::Cyan)
        } else {
            Cell::new(mount)
        };

        let usage_cell = if child.mountpoint.is_some() && usage != "-" {
            let pct: Option<u32> = usage.trim_end_matches('%').parse().ok();
            if use_colors {
                match pct {
                    Some(p) if p >= 90 => Cell::new(usage).fg(Color::Red),
                    Some(p) if p >= 75 => Cell::new(usage).fg(Color::Yellow),
                    _ => Cell::new(usage).fg(Color::Green),
                }
            } else {
                Cell::new(usage)
            }
        } else {
            Cell::new(usage)
        };

        table.add_row(vec![
            name_cell,
            Cell::new(size),
            Cell::new(fstype),
            mount_cell,
            usage_cell,
            Cell::new(""), // No health for partitions
        ]);

        if !child.children.is_empty() {
            add_children_rows(table, &child.children, depth + 1, use_colors);
        }
    }
}

/// Main drives command
pub fn drives_command() -> Result<(), String> {
    debug!("Listing drives with health, size, and partition information");

    let devices = get_block_devices()?;

    if devices.is_empty() {
        println!("No block devices found.");
        return Ok(());
    }

    let use_colors = io::stdout().is_terminal();

    let mut table = Table::new();
    table
        .load_preset(UTF8_FULL_CONDENSED)
        .set_content_arrangement(ContentArrangement::Dynamic);

    // Header
    table.set_header(vec![
        Cell::new("DEVICE").add_attribute(Attribute::Bold),
        Cell::new("SIZE").add_attribute(Attribute::Bold),
        Cell::new("TYPE").add_attribute(Attribute::Bold),
        Cell::new("MOUNT").add_attribute(Attribute::Bold),
        Cell::new("USED").add_attribute(Attribute::Bold),
        Cell::new("HEALTH").add_attribute(Attribute::Bold),
    ]);

    let mut needs_sudo = false;
    let mut needs_smartctl = false;

    for device in &devices {
        let health = get_smart_health(&device.name);

        let health_cell = match &health {
            SmartResult::Passed => {
                if use_colors {
                    Cell::new("PASSED").fg(Color::Green)
                } else {
                    Cell::new("PASSED")
                }
            }
            SmartResult::Failed => {
                if use_colors {
                    Cell::new("FAILED").fg(Color::Red)
                } else {
                    Cell::new("FAILED")
                }
            }
            SmartResult::Unknown(s) => {
                if use_colors {
                    Cell::new(s).fg(Color::Yellow)
                } else {
                    Cell::new(s)
                }
            }
            SmartResult::NotInstalled => {
                needs_smartctl = true;
                if use_colors {
                    Cell::new("-").fg(Color::DarkGrey)
                } else {
                    Cell::new("-")
                }
            }
            SmartResult::PermissionDenied => {
                needs_sudo = true;
                if use_colors {
                    Cell::new("-").fg(Color::DarkGrey)
                } else {
                    Cell::new("-")
                }
            }
        };

        let size = device.size.as_deref().unwrap_or("-");
        let fstype = device.fstype.as_deref().unwrap_or("-");
        let mount = device.mountpoint.as_deref().unwrap_or("-");
        let usage = device.fsuse_percent.as_deref().unwrap_or("-");
        let model = device.model.as_deref().unwrap_or("");

        // Disk name with model
        let disk_label = if model.is_empty() {
            device.name.clone()
        } else {
            format!("{} ({})", device.name, model)
        };

        let name_cell = if use_colors {
            Cell::new(&disk_label).add_attribute(Attribute::Bold)
        } else {
            Cell::new(&disk_label)
        };

        table.add_row(vec![
            name_cell,
            Cell::new(size),
            Cell::new(fstype),
            Cell::new(mount),
            Cell::new(usage),
            health_cell,
        ]);

        // Add partitions
        add_children_rows(&mut table, &device.children, 1, use_colors);
    }

    println!("{table}");

    // Print notes
    if needs_smartctl {
        if use_colors {
            println!("\n\x1b[33mNote: Install smartmontools and run with sudo for health status\x1b[0m");
        } else {
            println!("\nNote: Install smartmontools and run with sudo for health status");
        }
    } else if needs_sudo {
        if use_colors {
            println!("\n\x1b[33mNote: Run with sudo for health status\x1b[0m");
        } else {
            println!("\nNote: Run with sudo for health status");
        }
    }

    Ok(())
}
