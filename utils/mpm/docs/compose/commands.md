# Commands Reference

Complete reference for all `mpm compose` commands.

## mpm compose up

Render templates and deploy the application.

```bash
mpm compose up
```

**What it does:**
1. Finds `mows-manifest.yaml` in current directory or parent directories
2. Clears `results/` directory (preserving `generated-secrets.env`)
3. Renders `templates/generated-secrets.env` with merge logic
4. Copies `provided-secrets.env` to `results/`
5. Renders all files in `templates/config/` to `results/config/`
6. Renders `templates/docker-compose.yaml` with label flattening
7. Sets up `data/` directory symlink
8. Renders `templates/admin-infos.yaml` (if present)
9. Runs pre-deployment checks (Traefik, volumes, etc.)
10. Executes: `docker compose -p PROJECT_NAME --project-directory results/ up --build -d --remove-orphans`
11. Runs post-deployment health checks

**Implicit behaviors:**
- Docker must be installed and running
- Env files are automatically passed: `--env-file results/generated-secrets.env --env-file results/provided-secrets.env`
- Build context paths are relative to `results/` directory

## mpm compose init

Initialize a new mpm compose project.

```bash
# Use git repo name as project name
mpm compose init

# Specify a custom project name
mpm compose init my-project
```

**What it does:**
1. Determines project name (from argument or git remote/directory name)
2. Scans repository for Dockerfiles
3. Creates `deployment/` directory structure
4. Generates `mows-manifest.yaml` with project name
5. Generates `values.yaml` with detected services
6. Generates `templates/docker-compose.yaml` with service templates
7. Creates placeholder secret files
8. Registers project in global config (`~/.config/mows.cloud/mpm.yaml`)

**Auto-detection:**
When Dockerfiles are found, generates appropriate service definitions:

```
# If found: server/Dockerfile, web/Dockerfile
# Generates values.yaml:
services:
  server:
    build:
      enabled: true
      context: ../../server
      dockerfile: Dockerfile
  web:
    build:
      enabled: true
      context: ../../web
      dockerfile: Dockerfile
```

**Skipped directories:** `.git`, `node_modules`, `target`, `vendor`, `dist`, `build`, `deployment`

## mpm compose install

Install a project from a git repository.

```bash
# Install to current directory
mpm compose install https://github.com/user/project.git

# Install to specific directory
mpm compose install https://github.com/user/project.git --target /path/to/install
```

**What it does:**
1. Validates URL (rejects dangerous characters, `file://` URLs)
2. Clones repository with shallow clone (`--depth 1`)
3. Removes `.git` directory (no history)
4. Searches for `mows-manifest.yaml` in repository
5. Registers project in global config

**Supported URL formats:**
- `https://github.com/user/repo.git`
- `git@github.com:user/repo.git`
- `ssh://git@github.com/user/repo.git`

**Output:** Prints `cd <path>` instruction for easy navigation.

## mpm compose update

Update an installed project to the latest version.

```bash
mpm compose update
```

**What it does:**
1. Pulls latest changes from git remote
2. Finds new manifest location (in case it moved)
3. Merges new `values.yaml` with existing values:
   - Existing values take precedence
   - New keys are added
   - Removed keys are commented out with a note
4. Preserves `generated-secrets.env` and `provided-secrets.env`
5. Updates global config if manifest path changed

## mpm compose cd

Get the path to a project's manifest directory.

```bash
# Get path to project
mpm compose cd my-project

# Use with cd command
cd $(mpm compose cd my-project)

# When multiple instances exist
mpm compose cd my-project --instance production
```

**Behavior:**
- Returns absolute path to the directory containing `mows-manifest.yaml`
- If multiple instances of a project exist, you must specify `--instance`
- Errors if project not found in config

## mpm compose secrets regenerate

Regenerate generated secrets.

```bash
# Regenerate all secrets
mpm compose secrets regenerate

# Regenerate a specific secret
mpm compose secrets regenerate DB_PASSWORD
```

**What it does:**
1. Reads `results/generated-secrets.env`
2. Clears specified secret value(s) to empty
3. Re-runs the generation template
4. New values are generated for empty keys

**Use cases:**
- Password rotation
- Compromised secret replacement
- Reset to new random values

## mpm compose [passthrough]

Any unrecognized command is passed to `docker compose` with project context.

```bash
# These are passed through to docker compose:
mpm compose logs
mpm compose logs -f web
mpm compose ps
mpm compose stop
mpm compose down
mpm compose exec web bash
mpm compose restart web
```

**Automatic arguments added:**
- `--project-directory results/`
- `-f results/docker-compose.yaml` (or `.yml`)
- `-p PROJECT_NAME`
- `--env-file results/generated-secrets.env` (if exists)
- `--env-file results/provided-secrets.env` (if exists)

**Examples:**
```bash
# View logs
mpm compose logs -f

# Execute command in container
mpm compose exec web sh

# Stop all services
mpm compose stop

# Remove everything
mpm compose down -v
```

## Global Options

Available on all commands:

| Option | Description |
|--------|-------------|
| `-V, --verbose` | Enable debug logging |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MPM_CONFIG_PATH` | Override config file location | `~/.config/mows.cloud/mpm.yaml` |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error (config, template, I/O) |
| Non-zero | Docker compose exit code (for passthrough commands) |
