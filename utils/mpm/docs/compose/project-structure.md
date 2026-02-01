# Project Structure

A mows package-manager compose project follows a specific directory structure. Understanding each file's purpose helps you organize your deployments effectively.

## Directory Layout

```
deployment/
├── mows-manifest.yaml        # Required: Project metadata
├── values.yaml               # Required: Configuration values
├── provided-secrets.env      # Optional: User-provided secrets
├── templates/                # Required: Template directory
│   ├── docker-compose.yaml   # Required: Docker Compose template
│   ├── generated-secrets.env # Optional: Secret generation template
│   ├── config/               # Optional: Additional config templates
│   └── admin-infos.yaml      # Optional: Admin information template
├── data/                     # Optional: Persistent data directory
├── results/                  # Generated: Output directory
└── .gitignore               # Recommended: Ignore results and secrets
```

## File Reference

### mows-manifest.yaml

The project manifest defines metadata about your deployment:

```yaml
manifestVersion: "0.1"
metadata:
  name: my-project           # Required: Project name (used in docker compose -p)
  description: "My app"      # Optional: Human-readable description
  version: "1.0.0"           # Optional: Project version
spec: {}                     # Reserved for future use
```

**Implicit defaults:**
- `description`: empty string
- `version`: empty string

The project name is used as:
- The Docker Compose project name (`-p my-project`)
- The identifier for `mows package-manager compose cd my-project`

### values.yaml

Configuration values used in templates. Supports YAML or JSON format.

```yaml
# values.yaml
hostname: example.com
port: 8080
replicas: 3

database:
  host: localhost
  port: 5432
  name: myapp

services:
  web:
    build:
      enabled: true
      context: ../web
      dockerfile: Dockerfile
    # Commented values are used when build.enabled is false
    # image: myregistry/web:latest
```

**Supported file names:** `values.yaml`, `values.yml`, `values.json`

**Implicit defaults:**
- If no values file exists, an empty object `{}` is used
- Missing keys in templates result in empty strings

### provided-secrets.env

User-provided secrets that should NOT be committed to git:

```bash
# provided-secrets.env
API_KEY=your-secret-api-key
OAUTH_CLIENT_SECRET=client-secret-here
EXTERNAL_SERVICE_TOKEN=token123
```

**Important:** This file should be in `.gitignore`. It's copied to `results/provided-secrets.env` during render.

### templates/docker-compose.yaml

The Docker Compose template using Go template syntax:

```yaml
services:
  web:
    {{- if eq .services.web.build.enabled true }}
    build:
      context: "{{ .services.web.build.context }}"
      dockerfile: "{{ .services.web.build.dockerfile }}"
    {{- else }}
    image: "{{ .services.web.image }}"
    {{- end }}
    environment:
      - DATABASE_URL=postgres://{{ .database.host }}:{{ .database.port }}/{{ .database.name }}
    labels:
      traefik:
        http:
          routers:
            web:
              rule: "Host(`{{ .hostname }}`)"
    restart: unless-stopped
```

**Label flattening:** Nested label structures are automatically flattened to dot notation:
```yaml
# This nested structure:
labels:
  traefik:
    http:
      routers:
        web:
          rule: "Host(`example.com`)"

# Becomes:
labels:
  traefik.http.routers.web.rule: "Host(`example.com`)"
```

### templates/generated-secrets.env

Template for auto-generated secrets. Values are generated once and preserved:

```bash
# templates/generated-secrets.env
DB_PASSWORD={{ randAlphaNum 32 }}
SESSION_SECRET={{ randAlphaNum 64 }}
API_SECRET_KEY={{ uuidv4 }}
```

**Behavior:**
- First run: All secrets are generated
- Subsequent runs: Existing non-empty values are preserved
- Empty values are regenerated each run
- Use `mows package-manager compose secrets regenerate` to force regeneration

### templates/config/

Directory for additional configuration file templates. All files are rendered and copied to `results/config/`.

```
templates/config/
├── nginx.conf
├── app.toml
└── subsystem/
    └── settings.json
```

### templates/admin-infos.yaml

Optional template for admin documentation. Has access to secrets:

```yaml
# templates/admin-infos.yaml
project: {{ $chart.projectName }}
version: {{ $chart.version }}

database:
  host: {{ .database.host }}
  password: {{ $generatedSecrets.DB_PASSWORD }}

api_key: {{ $providedSecrets.API_KEY }}
```

**Special variables:**
- `$generatedSecrets` - Map of generated secrets
- `$providedSecrets` - Map of provided secrets

Output is written to `admin-infos.yaml` (not in results/).

### data/

Persistent data directory. A symlink is created at `results/data` pointing here.

**Permissions:** Directory is set to `755` (rwxr-xr-x)

Use for:
- Database data directories
- Uploaded files
- Application state

### results/

Generated output directory. Created and populated during `mows package-manager compose up`.

**Contents after render:**
```
results/
├── docker-compose.yaml    # Rendered compose file
├── generated-secrets.env  # Generated secrets (preserved across runs)
├── provided-secrets.env   # Copy of provided secrets
├── config/                # Rendered config files
└── data -> ../data        # Symlink to data directory
```

**Important:**
- `generated-secrets.env` is preserved when clearing results
- All other files are regenerated on each run
- Should be in `.gitignore`

### .gitignore

Recommended content:

```gitignore
admin-infos.yaml
results
provided-secrets.env
```

## Template Variables

All templates have access to these variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `.` (root) | All values from values.yaml | `.hostname`, `.database.host` |
| `$chart.projectName` | From manifest metadata.name | `my-project` |
| `$chart.description` | From manifest metadata.description | `My application` |
| `$chart.version` | From manifest metadata.version | `1.0.0` |

In `admin-infos.yaml` only:
| Variable | Description |
|----------|-------------|
| `$generatedSecrets` | Map of key-value from generated-secrets.env |
| `$providedSecrets` | Map of key-value from provided-secrets.env |
