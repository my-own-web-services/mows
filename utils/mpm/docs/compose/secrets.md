# Secrets Management

mpm compose handles two types of secrets: generated secrets (auto-created from templates) and provided secrets (user-supplied credentials).

## Overview

| Type | File | Purpose | Git Status |
|------|------|---------|------------|
| Generated | `templates/generated-secrets.env` | Auto-generated credentials | Committed |
| Generated Output | `results/generated-secrets.env` | Actual secret values | **Ignored** |
| Provided | `provided-secrets.env` | User-supplied secrets | **Ignored** |
| Provided Output | `results/provided-secrets.env` | Copy for Docker | **Ignored** |

## Generated Secrets

### Creating the Template

Create `templates/generated-secrets.env` with template functions:

```bash
# Database credentials
DB_USERNAME={{ randAlphaNum 16 }}
DB_PASSWORD={{ randAlphaNum 32 }}

# Application secrets
SESSION_SECRET={{ randAlphaNum 64 }}
JWT_SECRET={{ randAlphaNum 48 }}
API_KEY={{ uuidv4 }}

# Service-specific
REDIS_PASSWORD={{ randAlphaNum 24 }}
RABBITMQ_PASSWORD={{ randAlphaNum 24 }}
```

### Available Functions

| Function | Output | Example |
|----------|--------|---------|
| `randAlphaNum N` | Alphanumeric string | `a8Bk92mNpQ...` |
| `randAlpha N` | Letters only | `aBcDeFgHiJ...` |
| `randNumeric N` | Numbers only | `8294756103...` |
| `randAscii N` | ASCII printable | `a#9$kL@2...` |
| `uuidv4` | UUID v4 | `550e8400-e29b-41d4-a716-446655440000` |

### Merge Behavior

When `mpm compose up` runs:

1. Template is rendered with random values
2. Existing `results/generated-secrets.env` is read
3. Values are merged:
   - **Non-empty existing values are preserved**
   - **Empty values are replaced with new generated values**
   - **New keys are added**

This means secrets are generated once and preserved across deployments.

### Example Merge

```bash
# Existing results/generated-secrets.env
DB_PASSWORD=existingPassword123
SESSION_SECRET=

# Template generates
DB_PASSWORD=newRandomPassword
SESSION_SECRET=newRandomSession
NEW_KEY=newValue

# Result (merged)
DB_PASSWORD=existingPassword123  # Preserved (was non-empty)
SESSION_SECRET=newRandomSession   # Replaced (was empty)
NEW_KEY=newValue                  # Added (new key)
```

### Regenerating Secrets

To regenerate specific secrets or all secrets:

```bash
# Regenerate a single secret
mpm compose secrets regenerate DB_PASSWORD

# Regenerate all secrets
mpm compose secrets regenerate
```

This:
1. Clears the value(s) to empty
2. Re-runs the template rendering
3. New random values are generated

## Provided Secrets

### Creating the File

Create `provided-secrets.env` in your deployment directory:

```bash
# External API credentials
STRIPE_SECRET_KEY=sk_live_...
SENDGRID_API_KEY=SG...
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# OAuth credentials
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_SECRET=...

# Database credentials (if external)
EXTERNAL_DB_PASSWORD=...
```

### Important Notes

- **Never commit this file** - add to `.gitignore`
- File is copied to `results/provided-secrets.env` during render
- Both source and output have restricted permissions (600)

## Using Secrets in Docker Compose

Secrets are automatically loaded via `--env-file`:

```yaml
# templates/docker-compose.yaml
services:
  app:
    environment:
      # Reference env vars - Docker loads them from env files
      - DB_PASSWORD
      - SESSION_SECRET
      - STRIPE_SECRET_KEY

      # Or with explicit syntax
      - DATABASE_URL=postgres://user:${DB_PASSWORD}@db:5432/app
```

**Implicit behavior:** mpm adds these flags to docker compose:
```
--env-file results/generated-secrets.env
--env-file results/provided-secrets.env
```

## Using Secrets in admin-infos.yaml

The `templates/admin-infos.yaml` template has access to secret values:

```yaml
# templates/admin-infos.yaml
project: {{ $chart.projectName }}

database:
  host: {{ .database.host }}
  username: {{ $generatedSecrets.DB_USERNAME }}
  password: {{ $generatedSecrets.DB_PASSWORD }}

external_services:
  stripe_key: {{ $providedSecrets.STRIPE_SECRET_KEY }}
```

**Output:** Written to `admin-infos.yaml` (not in results/)

This is useful for:
- Documenting access credentials
- Creating admin reference sheets
- Backup of important configuration

## Security Features

### File Permissions

| File | Mode | Meaning |
|------|------|---------|
| `results/generated-secrets.env` | 600 | Owner read/write only |
| `results/provided-secrets.env` | 600 | Owner read/write only |

### Git Protection

Default `.gitignore` includes:
```
results
provided-secrets.env
admin-infos.yaml
```

### Best Practices

1. **Never commit secrets** - use `.gitignore`
2. **Use strong random values** - `randAlphaNum 32` or longer
3. **Rotate regularly** - use `secrets regenerate`
4. **Backup securely** - store `admin-infos.yaml` safely
5. **Separate environments** - different secrets per instance

## Troubleshooting

### Secret Not Regenerating

If a secret isn't regenerating, check if it has a non-empty value:

```bash
cat results/generated-secrets.env | grep KEY_NAME
```

Non-empty values are preserved. Use `mpm compose secrets regenerate KEY_NAME` to force regeneration.

### Secrets Not Available in Container

1. Check env file exists: `ls -la results/*.env`
2. Check permissions: `stat results/generated-secrets.env`
3. Check docker compose logs: `mpm compose logs`
4. Verify variable name matches exactly (case-sensitive)

### Permission Denied

If you get permission errors:
```bash
# Check file ownership
ls -la results/

# Fix permissions if needed
chmod 600 results/*.env
```
