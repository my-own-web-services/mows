# Deployment Checks

mpm compose runs automatic checks before and after deployment to catch common issues early.

## Pre-Deployment Checks

These checks run after templates are rendered but before `docker compose up`:

### Traefik Integration

When your docker-compose uses Traefik labels, mpm checks:

| Check | Description |
|-------|-------------|
| Traefik container exists | Is there a running Traefik container? |
| Network connectivity | Does your service share a network with Traefik? |
| Label format | Are Traefik labels correctly formatted? |

**Example warning:**
```
[WARN] Traefik labels detected but no Traefik container found
       Service 'web' has traefik.enable=true but Traefik is not running
       Hint: Start Traefik first or remove traefik labels
```

### Volume Mounts

Checks that mounted files and directories exist:

| Check | Description |
|-------|-------------|
| File exists | Do mounted files exist on the host? |
| Directory exists | Do mounted directories exist? |
| Read permissions | Can the files be read? |

**Example warning:**
```
[WARN] Volume mount target does not exist
       Service 'web' mounts ./config/nginx.conf but file not found
       Hint: Create the file or update the volume mount
```

### Ofelia/Watchtower Integration

When using Ofelia (cron) or Watchtower (auto-update):

| Check | Description |
|-------|-------------|
| Handler exists | Is the Ofelia/Watchtower container running? |
| Label format | Are job labels correctly formatted? |

## Post-Deployment Checks

These checks run after `docker compose up` completes:

### Container Health

| Check | Description |
|-------|-------------|
| Container running | Are all containers in running state? |
| Health status | Do containers with healthchecks report healthy? |
| Exit codes | Did any containers exit unexpectedly? |

**Example output:**
```
[INFO] Health Check Results
       web: running (healthy)
       db: running (healthy)
       worker: running

[WARN] Container 'cache' is not running
       Status: exited (1)
       Hint: Check logs with 'mpm compose logs cache'
```

### Service Connectivity

If services expose ports, mpm can verify they're reachable:

| Check | Description |
|-------|-------------|
| Port listening | Is the service accepting connections? |
| HTTP response | Does HTTP endpoint return success status? |

## Check Output

Checks are displayed with severity levels:

| Level | Symbol | Meaning |
|-------|--------|---------|
| Info | `[INFO]` | Informational, no action needed |
| Warning | `[WARN]` | Potential issue, deployment continues |
| Error | `[ERROR]` | Critical issue, may cause failures |

## Disabling Checks

Checks are informational and don't block deployment. They help identify issues but allow you to proceed even with warnings.

## Common Issues and Solutions

### Traefik Not Found

```
[WARN] Traefik container not found on any network
```

**Solutions:**
1. Start Traefik first: `docker compose up -d` in Traefik directory
2. Check Traefik container name matches expected pattern
3. Ensure your service joins Traefik's network

### Network Mismatch

```
[WARN] Service 'web' not on same network as Traefik
       web networks: [default]
       Traefik networks: [traefik]
```

**Solution:** Add the Traefik network to your service:

```yaml
services:
  web:
    networks:
      - default
      - traefik

networks:
  traefik:
    external: true
```

### Missing Volume

```
[WARN] Volume mount target does not exist: ./config/app.conf
```

**Solutions:**
1. Create the file: `touch config/app.conf`
2. Update the volume path in docker-compose
3. Remove the volume mount if not needed

### Container Not Healthy

```
[WARN] Container 'db' health: unhealthy
       Failing health check for 30s
```

**Solutions:**
1. Check container logs: `mpm compose logs db`
2. Verify healthcheck command in docker-compose
3. Increase healthcheck timeout if needed
4. Check application configuration

## Writing Custom Healthchecks

Add healthchecks to your docker-compose template:

```yaml
services:
  web:
    image: nginx
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

### Common Healthcheck Commands

| Service Type | Healthcheck |
|--------------|-------------|
| HTTP API | `curl -f http://localhost:PORT/health` |
| PostgreSQL | `pg_isready -U postgres` |
| Redis | `redis-cli ping` |
| MySQL | `mysqladmin ping -h localhost` |
| MongoDB | `mongo --eval "db.adminCommand('ping')"` |
