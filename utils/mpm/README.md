# mpm - MOWS Package Manager

mpm is a deployment tool that brings Helm-like templating to Docker Compose. Manage containerized applications with templated configurations, automatic secret generation, and deployment health checks.

## Features

- **Go Templates for Docker Compose** - Use variables, conditionals, and loops in your docker-compose files
- **Automatic Secret Generation** - Generate and persist random passwords, API keys, and tokens
- **Project Management** - Track and navigate between multiple deployments
- **Label Flattening** - Write Traefik labels as nested YAML, auto-converted to dot notation
- **Deployment Checks** - Pre and post-deployment validation
- **Self-Update** - Update mpm with checksum and SSH signature verification

## Installation

### Binary (Linux)

Pre-built binaries are available for **x86_64 (amd64)** and **aarch64 (arm64)** architectures.

```bash
curl -fsSL https://raw.githubusercontent.com/my-own-web-services/mows/main/utils/mpm/scripts/install.sh | bash
```

Options via environment variables:
- `MPM_VERSION` - Install a specific version (default: latest)
- `MPM_INSTALL_DIR` - Custom install directory (default: /usr/local/bin or ~/.local/bin)

```bash
# Example: install specific version to custom directory
MPM_VERSION=0.3.0 MPM_INSTALL_DIR=~/bin curl -fsSL ... | bash
```

### From Source

Requires Rust toolchain:

```bash
cargo install --path .
```

## Quick Start

### 1. Initialize a Project

```bash
cd your-project
mpm compose init
```

This creates a `deployment/` directory with templates.

### 2. Configure Values

Edit `deployment/values.yaml`:

```yaml
hostname: example.com
port: 8080
```

### 3. Create Docker Compose Template

Edit `deployment/templates/docker-compose.yaml`:

```yaml
services:
  web:
    image: nginx
    environment:
      - HOSTNAME={{ .hostname }}
      - PORT={{ .port }}
    labels:
      traefik:
        http:
          routers:
            web:
              rule: "Host(`{{ .hostname }}`)"
```

### 4. Deploy

```bash
cd deployment
mpm compose up
```

## Documentation

### Compose

- [Getting Started](docs/compose/getting-started.md) - Quick introduction
- [Project Structure](docs/compose/project-structure.md) - Files and directories explained
- [Commands Reference](docs/compose/commands.md) - All compose commands
- [Values and Templating](docs/compose/values-and-templating.md) - Template syntax and functions
- [Secrets Management](docs/compose/secrets.md) - Generated and provided secrets
- [Deployment Checks](docs/compose/checks.md) - Pre and post-deployment validation

### Other Features

- [Tools Reference](docs/tools/overview.md) - JSON/YAML conversion, jq queries
- [Self-Update](docs/self-update.md) - Updating mpm
- [Configuration](docs/configuration.md) - Config file and environment variables
- [Development Guide](docs/development.md) - Building, testing, and contributing

## Command Overview

```bash
# Compose commands
mpm compose init [NAME]              # Initialize new project
mpm compose up                       # Render and deploy
mpm compose install <URL>            # Install from git repo
mpm compose update                   # Update to latest version
mpm compose cd <PROJECT>             # Get project path
mpm compose secrets regenerate [KEY] # Regenerate secrets
mpm compose <docker-compose-cmd>     # Passthrough to docker compose

# Tools
mpm tools json-to-yaml               # Convert JSON to YAML
mpm tools yaml-to-json               # Convert YAML to JSON
mpm tools prettify-json              # Format JSON
mpm tools expand-object              # Dot notation to nested
mpm tools flatten-object             # Nested to dot notation
mpm tools jq <FILTER>                # Query JSON/YAML
mpm tools cargo-workspace-docker           # Generate cargo-workspace-docker.toml
mpm tools cargo-workspace-docker --all     # Regenerate for all packages

# Template
mpm template -i <IN> -o <OUT>        # Render Go templates

# Self-update
mpm self-update                      # Update to latest version
mpm self-update --build              # Build from source with signature verification
```

## Example: Full Project Setup

```bash
# Initialize in a git repository
cd my-webapp
mpm compose init

# Edit configuration
cd deployment
vim values.yaml
vim templates/docker-compose.yaml

# Add secrets
vim provided-secrets.env
vim templates/generated-secrets.env

# Deploy
mpm compose up

# View logs
mpm compose logs -f

# Navigate back later
cd $(mpm compose cd my-webapp)
```

## Template Features

### Variables and Conditionals

```yaml
services:
  app:
    {{- if eq .services.app.build.enabled true }}
    build:
      context: "{{ .services.app.build.context }}"
    {{- else }}
    image: "{{ .services.app.image }}"
    {{- end }}
    environment:
      - PORT={{ .port | default 8080 }}
```

### Secret Generation

In `templates/generated-secrets.env`:
```bash
DB_PASSWORD={{ randAlphaNum 32 }}
JWT_SECRET={{ randAlphaNum 64 }}
API_KEY={{ uuidv4 }}
```

Secrets are generated once and preserved across deployments.

### Automatic Label Flattening

Write labels as nested YAML:
```yaml
labels:
  traefik:
    http:
      routers:
        web:
          rule: "Host(`{{ .hostname }}`)"
```

Automatically converted to Docker-compatible format:
```yaml
labels:
  traefik.http.routers.web.rule: "Host(`example.com`)"
```

## Template Functions

Full list in [Values and Templating](docs/compose/values-and-templating.md). Highlights:

| Function | Example | Description |
|----------|---------|-------------|
| `randAlphaNum N` | `{{ randAlphaNum 32 }}` | Random alphanumeric string |
| `uuidv4` | `{{ uuidv4 }}` | Random UUID v4 |
| `default` | `{{ .port \| default 8080 }}` | Default value if empty |
| `upper` | `{{ upper .name }}` | Uppercase string |
| `b64enc` | `{{ b64enc .data }}` | Base64 encode |
| `toJson` | `{{ toJson .config }}` | Convert to JSON |

## Self-Update

Update mpm to the latest version:

```bash
# Binary download with checksum verification
mpm self-update

# Build from source with SSH signature verification
mpm self-update --build
```

mpm automatically checks for updates in the background and notifies you when a new version is available.

## Verbose Mode

Enable debug logging with `-V` or `--verbose`:

```bash
mpm -V compose up
```

For trace-level logging:

```bash
RUST_LOG=trace mpm compose up
```

## License

MIT
