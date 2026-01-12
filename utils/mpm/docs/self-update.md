# Self-Update

mpm can update itself to the latest version with built-in integrity verification.

## Quick Update

```bash
mpm self-update
```

This downloads the latest pre-built binary, verifies its checksum, and replaces the current installation.

## Update Methods

### Binary Download (Default)

Downloads a pre-built binary from GitHub releases:

```bash
mpm self-update
```

**Process:**
1. Fetches latest version from GitHub API
2. Downloads binary for your OS/architecture
3. Downloads SHA256 checksum file
4. Verifies checksum matches
5. Creates backup of current binary
6. Replaces binary atomically
7. Cleans up backup on success

**Supported platforms:**
- Linux amd64 (`mpm-X.Y.Z-linux-amd64`)
- Linux arm64 (`mpm-X.Y.Z-linux-arm64`)

### Build from Source

Build and install from source with cryptographic verification:

```bash
mpm self-update --build
```

**Process:**
1. Clones the repository
2. Finds the release tag
3. **Verifies SSH signature on the tag** against hardcoded trusted key
4. Builds using Docker (`./build.sh`)
5. Replaces binary with built version

**Requirements:**
- Git
- Docker (running)

**Security:** This method verifies the release tag was signed by a trusted maintainer key, providing stronger supply-chain security.

## Update to Specific Version

```bash
# Binary download
mpm self-update --version 0.2.0

# Build from source
mpm self-update --build --version 0.2.0
```

## Automatic Update Checks

mpm checks for updates in the background (non-blocking) and notifies you on subsequent runs:

```
A new version of mpm is available: 0.3.0 (current: 0.2.0)
Run 'mpm self-update' to update.
```

**Behavior:**
- Checks run at most once per hour
- Check results are cached in config file
- Network failures are silently ignored
- Never blocks command execution

**Disable notification:** The notification appears only when a newer version exists and you haven't updated.

## Security Features

### Checksum Verification

Binary downloads are verified using SHA256:

```
Downloading mpm v0.3.0...
Verifying checksum...
Checksum verified successfully.
```

If verification fails:
```
Checksum verification failed!
Expected: abc123...
Actual:   def456...
```

### SSH Signature Verification (--build)

When building from source, the git tag is verified against a hardcoded trusted key:

```
Cloning repository...
Target release tag: mpm-v0.3.0
Verifying SSH signature...
SSH signature verified successfully.
Building with Docker...
```

**Verification uses:**
- Ed25519 SSH key embedded in the binary
- Git's native signature verification
- Fails if tag is unsigned or signed with unknown key

### Backup and Rollback

Before replacement:
1. Current binary is copied to `mpm.backup`
2. New binary is installed
3. On success, backup is removed

If installation fails:
```
Update failed, attempting to restore backup...
Restored from backup successfully.
```

### Permission Handling

Update checks write permissions before attempting replacement:

```
Cannot update: no write permission to /usr/local/bin. Try running with sudo.
```

## Configuration

Update state is stored in `~/.config/mows.cloud/mpm.yaml`:

```yaml
compose:
  projects: []
update:
  availableVersion: "0.3.0"
  checkedAt: 2024-01-15T10:30:00Z
```

| Field | Description |
|-------|-------------|
| `availableVersion` | Latest known version |
| `checkedAt` | Last check timestamp |

**Check frequency:** At most once per hour (based on `checkedAt`).

## Command Reference

```bash
mpm self-update [OPTIONS]

Options:
    --build              Build from source instead of downloading binary
    --version <VERSION>  Install specific version (e.g., "0.2.0")
    -V, --verbose        Enable debug logging
    -h, --help           Print help
```

## Troubleshooting

### Permission Denied

```bash
# Use sudo for system-wide installation
sudo mpm self-update

# Or move mpm to user directory
mkdir -p ~/.local/bin
mv /usr/local/bin/mpm ~/.local/bin/
export PATH="$HOME/.local/bin:$PATH"
mpm self-update
```

### Network Issues

```
Failed to fetch latest release: connection timeout
```

Check your internet connection and try again. For proxied environments:

```bash
export HTTP_PROXY=http://proxy:8080
export HTTPS_PROXY=http://proxy:8080
mpm self-update
```

### Build Failures

```
Build failed
```

When using `--build`:
1. Ensure Docker is running: `docker info`
2. Check Docker has enough resources
3. Try with verbose mode: `mpm self-update --build -V`

### Signature Verification Failed

```
SSH signature verification failed. The tag may have been signed with a different key.
```

This means the release tag wasn't signed with the expected maintainer key. This could indicate:
- A tampered release
- A new maintainer key (update mpm to get new trusted key)
- Running a very old mpm version

**Solution:** Use binary download which verifies checksum: `mpm self-update`
