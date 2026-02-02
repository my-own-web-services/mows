# Tools Reference

mows includes several utility commands for data transformation and processing.

## mows tools json-to-yaml

Convert JSON to YAML format.

```bash
# From file
mows tools json-to-yaml -i input.json -o output.yaml

# From stdin
cat data.json | mows tools json-to-yaml

# To stdout
mows tools json-to-yaml -i input.json
```

**Options:**
| Option | Description |
|--------|-------------|
| `-i, --input <FILE>` | Input file (default: stdin) |
| `-o, --output <FILE>` | Output file (default: stdout) |

## mows tools yaml-to-json

Convert YAML to JSON format.

```bash
# From file
mows tools yaml-to-json -i input.yaml -o output.json

# From stdin
cat data.yaml | mows tools yaml-to-json

# To stdout
mows tools yaml-to-json -i input.yaml
```

**Options:**
| Option | Description |
|--------|-------------|
| `-i, --input <FILE>` | Input file (default: stdin) |
| `-o, --output <FILE>` | Output file (default: stdout) |

## mows tools prettify-json

Format JSON with proper indentation.

```bash
# Prettify a file
mows tools prettify-json -i compact.json -o formatted.json

# From stdin
echo '{"a":1,"b":2}' | mows tools prettify-json
```

**Output:**
```json
{
  "a": 1,
  "b": 2
}
```

**Options:**
| Option | Description |
|--------|-------------|
| `-i, --input <FILE>` | Input file (default: stdin) |
| `-o, --output <FILE>` | Output file (default: stdout) |

## mows tools expand-object

Convert flat dot-notation keys to nested objects.

```bash
# Expand a file
mows tools expand-object -i labels.yaml -o tree.yaml

# With selector for specific paths
mows tools expand-object -i compose.yaml --selector "services.*.labels"
```

**Example:**

Input:
```yaml
traefik.http.routers.web.rule: "Host(`example.com`)"
traefik.http.routers.web.entrypoints: websecure
traefik.http.services.web.port: "8080"
```

Output:
```yaml
traefik:
  http:
    routers:
      web:
        rule: "Host(`example.com`)"
        entrypoints: websecure
    services:
      web:
        port: "8080"
```

**Options:**
| Option | Description |
|--------|-------------|
| `-i, --input <FILE>` | Input file (default: stdin) |
| `-o, --output <FILE>` | Output file (default: stdout) |
| `--selector <PATH>` | Only expand at matching paths |

**Selector syntax:**
- `services.*.labels` - Expand labels in all services
- `config.settings` - Expand specific path
- Empty selector expands entire document

**Auto-detection:** If input is a Docker Compose file (has `services:` key), automatically uses selector `services.*.labels`.

## mows tools flatten-object

Convert nested objects to flat dot-notation keys.

```bash
# Flatten a file
mows tools flatten-object -i tree.yaml -o labels.yaml

# With selector
mows tools flatten-object -i compose.yaml --selector "services.*.labels"
```

**Example:**

Input:
```yaml
traefik:
  http:
    routers:
      web:
        rule: "Host(`example.com`)"
```

Output:
```yaml
traefik.http.routers.web.rule: "Host(`example.com`)"
```

**Options:**
| Option | Description |
|--------|-------------|
| `-i, --input <FILE>` | Input file (default: stdin) |
| `-o, --output <FILE>` | Output file (default: stdout) |
| `--selector <PATH>` | Only flatten at matching paths |

**Note:** This is the inverse of `expand-object`. Useful for converting human-readable configs to Docker label format.

## mows tools jq

Query and transform JSON/YAML using jq syntax.

```bash
# Simple query
mows tools jq '.name' -i data.yaml

# Complex filter
mows tools jq '.items[] | select(.active)' -i data.json

# Multiple files
cat data.yaml | mows tools jq '.version'
```

**Examples:**

```bash
# Get specific field
mows tools jq '.metadata.name' -i manifest.yaml

# Filter array
mows tools jq '.services | keys' -i docker-compose.yaml

# Transform data
mows tools jq '.items | map(.name)' -i data.json

# Conditional selection
mows tools jq '.users[] | select(.role == "admin")' -i users.yaml
```

**Options:**
| Option | Description |
|--------|-------------|
| `-i, --input <FILE>` | Input file (default: stdin) |
| `-o, --output <FILE>` | Output file (default: stdout) |

**Note:** Uses jaq (Rust jq implementation). Most jq filters are supported.

## mows template

Render Go templates with variable files.

```bash
# Basic usage
mows template -i template.yaml -o output.yaml

# With variables file
mows template -i template.yaml -o output.yaml --var values.yaml

# With inline variables
mows template -i template.yaml -o output.yaml --set hostname=example.com --set port=8080

# Directory rendering
mows template -i templates/ -o output/
```

**Options:**
| Option | Description |
|--------|-------------|
| `-i, --input <PATH>` | Template file or directory |
| `-o, --output <PATH>` | Output file or directory |
| `--var <FILE>` | Variables file (YAML/JSON) |
| `--set <KEY=VALUE>` | Set individual variable |

**Example:**

Template (`config.yaml.tmpl`):
```yaml
server:
  host: {{ .hostname }}
  port: {{ .port | default 8080 }}
```

Variables (`values.yaml`):
```yaml
hostname: example.com
port: 3000
```

Command:
```bash
mows template -i config.yaml.tmpl -o config.yaml --var values.yaml
```

Output (`config.yaml`):
```yaml
server:
  host: example.com
  port: 3000
```

## mows tools cargo-workspace-docker

Generate minimal `cargo-workspace-docker.toml` files for Dockerized Rust builds. This creates workspace configuration files containing only the dependencies needed for a specific package, enabling efficient Docker layer caching.

### Why This Tool Exists

When building Rust projects in Docker, cargo-chef is used to cache dependency compilation. However, in a monorepo with many packages, each Docker image only needs a subset of the workspace. The standard `Cargo.toml` workspace file includes all packages and their dependencies, which means:

1. **Cache invalidation**: Any dependency change anywhere in the monorepo invalidates the Docker cache for all images
2. **Build bloat**: Docker images contain dependency metadata for packages they don't use
3. **Path dependency issues**: Path dependencies like `{ path = "../common" }` don't work in Docker's isolated build context

This tool solves these problems by generating a minimal `cargo-workspace-docker.toml` that:
- Contains only the dependencies needed for the specific package being built
- Converts path dependencies to versioned crate references
- Enables independent Docker layer caching per package

### When to Regenerate

Regenerate `cargo-workspace-docker.toml` when:
- Adding or removing dependencies in `Cargo.toml`
- Updating dependency versions
- Adding new workspace members that your package depends on
- Before Docker builds (recommended to add to `build.sh`)

The file is deterministic, so regenerating when nothing changed produces identical output.

### Usage

```bash
# Generate for current package (finds nearest Cargo.toml with docker-compose)
mows tools cargo-workspace-docker

# Generate for all packages with docker-compose files in the workspace
mows tools cargo-workspace-docker --all

# Generate for a specific path
mows tools cargo-workspace-docker --path /path/to/package
```

**Options:**
| Option | Description |
|--------|-------------|
| `--all` | Regenerate for all packages with docker-compose files |
| `-p, --path <PATH>` | Path to package (default: current directory) |

**Features:**
- Automatically finds workspace root
- Resolves transitive dependencies from path dependencies
- Copies package version to `[workspace.package].version`
- Uses crate names for path dependencies (Docker-compatible)
- Deterministic output (sorted dependencies)

### Example Output

In Docker builds using cargo-chef, each package needs a minimal workspace with only its required dependencies. Running `mows tools cargo-workspace-docker` generates this file automatically:

```toml
# cargo-workspace-docker.toml (generated)
[workspace]
members = ["app"]
resolver = "2"

[workspace.dependencies.serde]
default-features = false
version = "1.0.219"

[workspace.package]
edition = "2021"
version = "0.2.2"  # Copied from package
```

**Integration with build scripts:**

Add to your `build.sh`:
```bash
#!/bin/bash
set -euo pipefail

mows tools cargo-workspace-docker  # Regenerate before Docker build

docker buildx bake ${BAKE_ARGS:-default}
```

## Pipeline Examples

Combine tools for complex transformations:

```bash
# Convert YAML to pretty JSON
cat data.yaml | mows tools yaml-to-json | mows tools prettify-json

# Query YAML with jq
mows tools yaml-to-json -i config.yaml | mows tools jq '.services | keys'

# Expand labels in compose file then query
cat compose.yaml | mows tools expand-object | mows tools jq '.services.web.labels.traefik'

# Template and validate
mows template -i template.yaml --var values.yaml | mows tools yaml-to-json > /dev/null && echo "Valid YAML"
```
