# Tools Reference

mpm includes several utility commands for data transformation and processing.

## mpm tools json-to-yaml

Convert JSON to YAML format.

```bash
# From file
mpm tools json-to-yaml -i input.json -o output.yaml

# From stdin
cat data.json | mpm tools json-to-yaml

# To stdout
mpm tools json-to-yaml -i input.json
```

**Options:**
| Option | Description |
|--------|-------------|
| `-i, --input <FILE>` | Input file (default: stdin) |
| `-o, --output <FILE>` | Output file (default: stdout) |

## mpm tools yaml-to-json

Convert YAML to JSON format.

```bash
# From file
mpm tools yaml-to-json -i input.yaml -o output.json

# From stdin
cat data.yaml | mpm tools yaml-to-json

# To stdout
mpm tools yaml-to-json -i input.yaml
```

**Options:**
| Option | Description |
|--------|-------------|
| `-i, --input <FILE>` | Input file (default: stdin) |
| `-o, --output <FILE>` | Output file (default: stdout) |

## mpm tools prettify-json

Format JSON with proper indentation.

```bash
# Prettify a file
mpm tools prettify-json -i compact.json -o formatted.json

# From stdin
echo '{"a":1,"b":2}' | mpm tools prettify-json
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

## mpm tools expand-object

Convert flat dot-notation keys to nested objects.

```bash
# Expand a file
mpm tools expand-object -i labels.yaml -o tree.yaml

# With selector for specific paths
mpm tools expand-object -i compose.yaml --selector "services.*.labels"
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

## mpm tools flatten-object

Convert nested objects to flat dot-notation keys.

```bash
# Flatten a file
mpm tools flatten-object -i tree.yaml -o labels.yaml

# With selector
mpm tools flatten-object -i compose.yaml --selector "services.*.labels"
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

## mpm tools jq

Query and transform JSON/YAML using jq syntax.

```bash
# Simple query
mpm tools jq '.name' -i data.yaml

# Complex filter
mpm tools jq '.items[] | select(.active)' -i data.json

# Multiple files
cat data.yaml | mpm tools jq '.version'
```

**Examples:**

```bash
# Get specific field
mpm tools jq '.metadata.name' -i manifest.yaml

# Filter array
mpm tools jq '.services | keys' -i docker-compose.yaml

# Transform data
mpm tools jq '.items | map(.name)' -i data.json

# Conditional selection
mpm tools jq '.users[] | select(.role == "admin")' -i users.yaml
```

**Options:**
| Option | Description |
|--------|-------------|
| `-i, --input <FILE>` | Input file (default: stdin) |
| `-o, --output <FILE>` | Output file (default: stdout) |

**Note:** Uses jaq (Rust jq implementation). Most jq filters are supported.

## mpm template

Render Go templates with variable files.

```bash
# Basic usage
mpm template -i template.yaml -o output.yaml

# With variables file
mpm template -i template.yaml -o output.yaml --var values.yaml

# With inline variables
mpm template -i template.yaml -o output.yaml --set hostname=example.com --set port=8080

# Directory rendering
mpm template -i templates/ -o output/
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
mpm template -i config.yaml.tmpl -o config.yaml --var values.yaml
```

Output (`config.yaml`):
```yaml
server:
  host: example.com
  port: 3000
```

## mpm tools cargo-workspace-docker

Generate minimal `cargo-workspace-docker.toml` files for Dockerized Rust builds. This creates workspace configuration files containing only the dependencies needed for a specific package, enabling efficient Docker layer caching.

```bash
# Generate for current package (finds nearest Cargo.toml with docker-compose)
mpm tools cargo-workspace-docker

# Generate for all packages with docker-compose in the workspace
mpm tools cargo-workspace-docker --all

# Generate for a specific path
mpm tools cargo-workspace-docker --path /path/to/package
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

**Use Case:**

In Docker builds using cargo-chef, each package needs a minimal workspace with only its required dependencies. Running `mpm tools cargo-workspace-docker` generates this file automatically:

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

mpm tools cargo-workspace-docker  # Regenerate before Docker build

docker buildx bake ${BAKE_ARGS:-default}
```

## Pipeline Examples

Combine tools for complex transformations:

```bash
# Convert YAML to pretty JSON
cat data.yaml | mpm tools yaml-to-json | mpm tools prettify-json

# Query YAML with jq
mpm tools yaml-to-json -i config.yaml | mpm tools jq '.services | keys'

# Expand labels in compose file then query
cat compose.yaml | mpm tools expand-object | mpm tools jq '.services.web.labels.traefik'

# Template and validate
mpm template -i template.yaml --var values.yaml | mpm tools yaml-to-json > /dev/null && echo "Valid YAML"
```
