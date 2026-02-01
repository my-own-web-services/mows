# Configuration

mows uses a YAML configuration file to track installed projects and update state.

## Config File Location

**Default:** `~/.config/mows.cloud/mows.yaml`

**Override:** Set `MOWS_CONFIG_PATH` environment variable:

```bash
export MOWS_CONFIG_PATH=/path/to/custom/mows.yaml
mows package-manager compose up    # or: mpm compose up
```

This is useful for:
- Testing with isolated config
- Multiple configuration profiles
- CI/CD environments

## Config File Structure

```yaml
compose:
  projects:
    - projectName: my-app
      instanceName: null
      repoPath: /home/user/projects/my-app
      manifestPath: deployment

    - projectName: my-app
      instanceName: production
      repoPath: /home/user/projects/my-app-prod
      manifestPath: deployment

update:
  availableVersion: "0.3.0"
  checkedAt: 2024-01-15T10:30:00Z
```

## Project Entries

Each project entry tracks an installed compose project:

| Field | Type | Description |
|-------|------|-------------|
| `projectName` | string | Project name (from manifest) |
| `instanceName` | string? | Instance identifier (null if single instance) |
| `repoPath` | path | Absolute path to repository root |
| `manifestPath` | path | Relative path from repo to manifest directory |

### Multiple Instances

When you have multiple deployments of the same project (e.g., staging and production), use `instanceName` to distinguish them:

```yaml
compose:
  projects:
    - projectName: my-api
      instanceName: staging
      repoPath: /home/user/deployments/staging/my-api
      manifestPath: deployment

    - projectName: my-api
      instanceName: production
      repoPath: /home/user/deployments/production/my-api
      manifestPath: deployment
```

**Usage:**
```bash
# Navigate to specific instance
cd $(mows package-manager compose cd my-api --instance staging)
cd $(mows package-manager compose cd my-api --instance production)

# Or using the mpm shorthand:
cd $(mpm compose cd my-api --instance staging)
```

## Update Tracking

The `update` section tracks version check state:

| Field | Type | Description |
|-------|------|-------------|
| `availableVersion` | string | Latest known version |
| `checkedAt` | datetime | When last check occurred |

**Check frequency:** Maximum once per hour.

**Behavior:**
- If current version < `availableVersion`, shows update notification
- After successful update, `availableVersion` is cleared
- Network failures don't update `checkedAt` (allows retry)

## Automatic Config Management

mows automatically manages the config file:

### On `mows package-manager compose init`

Adds new project entry:
```yaml
compose:
  projects:
    - projectName: new-project    # From manifest
      instanceName: null
      repoPath: /abs/path/to/repo
      manifestPath: deployment
```

### On `mows package-manager compose install`

Adds entry for installed project:
```yaml
compose:
  projects:
    - projectName: installed-project
      instanceName: null
      repoPath: /path/where/installed
      manifestPath: path/to/manifest
```

### On `mows package-manager compose update`

Updates manifest path if it moved:
```yaml
compose:
  projects:
    - projectName: my-project
      manifestPath: new/location    # Updated
```

### On `mows self-update`

Clears update notification:
```yaml
update: null    # Or removed entirely
```

## Manual Editing

You can manually edit the config file. Common scenarios:

### Remove a Project

Delete the project entry:
```yaml
compose:
  projects:
    # Remove the entry for the project you want to forget
```

### Rename Instance

Change `instanceName`:
```yaml
compose:
  projects:
    - projectName: my-app
      instanceName: new-name    # Changed from old-name
```

### Fix Path

Update `repoPath` or `manifestPath` if moved:
```yaml
compose:
  projects:
    - projectName: my-app
      repoPath: /new/absolute/path
      manifestPath: new/relative/path
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MOWS_CONFIG_PATH` | Override config file location | `~/.config/mows.cloud/mows.yaml` |
| `MPM_CONFIG_PATH` | Legacy override (fallback) | `~/.config/mows.cloud/mows.yaml` |

## Config File Permissions

The config file is created with standard permissions (644). It doesn't contain secrets—those are stored in project directories.

## Troubleshooting

### Config Not Found

If config file doesn't exist, mows creates it with defaults:
```yaml
compose:
  projects: []
```

### Permission Error

```
Failed to write config: permission denied
```

Check directory permissions:
```bash
ls -la ~/.config/mows.cloud/
# Should be writable by your user
```

### Corrupt Config

If config becomes invalid YAML:
```
Failed to parse config: invalid YAML
```

**Solution:** Fix YAML syntax or delete and let mows recreate:
```bash
rm ~/.config/mows.cloud/mows.yaml
mows package-manager compose init  # Recreates config
```

### Project Not Found

```
Project 'my-app' not found in config
```

The project isn't registered. Either:
1. Run `mows package-manager compose init` in the project directory
2. Manually add entry to config file

### Multiple Projects Same Name

```
Multiple instances of 'my-app' found. Specify --instance:
  - staging (/path/to/staging)
  - production (/path/to/production)
```

Use `--instance` flag:
```bash
mows package-manager compose cd my-app --instance staging
# or: mpm compose cd my-app --instance staging
```
