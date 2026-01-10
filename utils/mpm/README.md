# mpm

MOWS Package Manager - Docker Compose deployments and template rendering CLI.

## Installation

```bash
cargo install mpm
```

## Commands

### Template Rendering

Render Go-style templates with variable files.

```bash
mpm template -i <INPUT> -o <OUTPUT> [--variable=<NAME:PATH>...]
```

**Options:**
- `-i, --input` - Template file or directory to render
- `-o, --output` - Output file or directory
- `--variable` - Variable file in format `name:path` (can be repeated)
- `-V, --verbose` - Enable debug logging

**Example:**

```bash
mpm template -i templates/ -o output/ \
  --variable=config:./config.yml \
  --variable=secrets:./secrets.env
```

#### Variable Files

Variables are loaded from files and made available in templates under their specified name. Supported formats:

| Format | Detection | Example |
|--------|-----------|---------|
| JSON | Auto-detected | `{"host": "localhost"}` |
| YAML | Auto-detected | `host: localhost` |
| .env | `.env` extension | `API_KEY=secret123` |

**.env file format:**
```env
# Comments are ignored
API_KEY=secret123
DEBUG=true
QUOTED="hello world"
```

#### Template Syntax

Templates use Go template syntax. Variables are accessed via `$name`:

```
Server: {{ $config.server.host }}:{{ $config.server.port }}
API Key: {{ $secrets.API_KEY }}

{{ if $config.debug }}
Debug mode enabled
{{ end }}

{{ range $config.items }}
- {{ . }}
{{ end }}
```

#### Template Functions

Mozart includes 155+ template functions from the Sprig-like library:

**String:** `upper`, `lower`, `trim`, `replace`, `contains`, `hasPrefix`, `hasSuffix`, `quote`, `squote`, etc.

**Math:** `add`, `sub`, `mul`, `div`, `mod`, `max`, `min`, `floor`, `ceil`, `round`

**Collections:** `first`, `last`, `append`, `concat`, `reverse`, `uniq`, `slice`, `keys`, `values`, `pick`, `omit`, `merge`

**Encoding:** `b64enc`, `b64dec`, `toJson`, `fromJson`, `toYaml`, `fromYaml`

**Crypto:** `sha256sum`, `sha1sum`, `md5sum`

**Logic:** `default`, `empty`, `coalesce`, `ternary`, `fail`

### Tools

#### JSON/YAML Conversion

```bash
# JSON to YAML
mpm tools json-to-yaml -i input.json -o output.yaml

# YAML to JSON
mpm tools yaml-to-json -i input.yaml -o output.json

# Prettify JSON
mpm tools prettify-json -i ugly.json -o pretty.json
```

#### Docker Compose Label Conversion

Convert between flat dot-notation labels and nested tree structures:

```bash
# Labels to tree
echo 'traefik.http.routers.app.rule: "Host(`example.com`)"' | mpm tools labels-to-tree

# Tree to labels
mpm tools tree-to-labels -i tree.yaml -o labels.yaml
```

#### JQ Queries

Run jq-style queries on JSON/YAML:

```bash
mpm tools jq '.items[].name' -i data.json
mpm tools jq '.config.server' -i config.yaml --yaml
```

## Verbose Mode

Enable debug logging with `-V` or `--verbose`:

```bash
mpm -V template -i templates/ -o output/ --variable=config:./config.yml
```

For trace-level logging, use the `RUST_LOG` environment variable:

```bash
RUST_LOG=trace mpm template -i templates/ -o output/ --variable=config:./config.yml
```

## Examples

### Render a Single Template

```bash
# config.yml
# server:
#   host: localhost
#   port: 8080

# template.txt
# Server URL: http://{{ $config.server.host }}:{{ $config.server.port }}

mpm template -i template.txt -o output.txt --variable=config:./config.yml
```

### Render a Directory of Templates

```bash
mpm template -i templates/ -o rendered/ \
  --variable=config:./config.yml \
  --variable=secrets:./secrets.env
```

### Using Environment Variables in Templates

```bash
# .env
# DATABASE_URL=postgres://localhost/mydb
# API_KEY=secret123

# template.txt
# db: {{ $env.DATABASE_URL }}
# key: {{ $env.API_KEY }}

mpm template -i template.txt -o output.txt --variable=env:./.env
```
