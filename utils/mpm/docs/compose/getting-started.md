# Getting Started with mpm compose

mpm compose is a deployment tool that brings Helm-like templating to Docker Compose. It allows you to manage containerized applications with templated configurations, automatic secret generation, and deployment checks.

## Quick Start

### 1. Initialize a New Project

Navigate to your project's git repository and run:

```bash
mpm compose init
```

This creates a `deployment/` directory with the following structure:

```
deployment/
├── mows-manifest.yaml      # Project metadata
├── values.yaml             # Configuration values
├── provided-secrets.env    # User-provided secrets (not committed)
├── templates/
│   ├── docker-compose.yaml # Docker Compose template
│   ├── generated-secrets.env # Secret generation template
│   └── config/             # Additional config file templates
├── data/                   # Persistent data directory
├── results/                # Generated output (gitignored)
└── .gitignore
```

### 2. Configure Your Project

Edit `deployment/values.yaml` to set your configuration:

```yaml
hostname: example.com
port: 8080
services:
  web:
    build:
      enabled: true
      context: ../web
      dockerfile: Dockerfile
```

### 3. Create Your Docker Compose Template

Edit `deployment/templates/docker-compose.yaml`:

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
      - HOSTNAME={{ .hostname }}
      - PORT={{ .port }}
    restart: unless-stopped
```

### 4. Deploy

```bash
mpm compose up
```

This command:
1. Renders all templates with your values
2. Generates any templated secrets
3. Runs pre-deployment checks
4. Executes `docker compose up -d --build --remove-orphans`
5. Runs post-deployment health checks

## Installing an Existing Project

To install a project from a git repository:

```bash
mpm compose install https://github.com/user/project.git
```

This clones the repository, finds the manifest, and registers the project in your local config.

## Navigating Between Projects

Once you have multiple projects installed, quickly navigate to them:

```bash
# Navigate to a project
cd $(mpm compose cd my-project)

# If you have multiple instances with the same name
cd $(mpm compose cd my-project --instance production)
```

## Next Steps

- [Project Structure](project-structure.md) - Understand all files and directories
- [Commands Reference](commands.md) - All available commands
- [Values and Templating](values-and-templating.md) - Template syntax and variables
- [Secrets Management](secrets.md) - Generated and provided secrets
