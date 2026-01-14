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

These checks run after `docker compose up` completes. mpm polls for up to 30 seconds waiting for containers to be ready before displaying health status.

### Container Health

Each container is checked for:

| Check | Description |
|-------|-------------|
| Running status | Is the container in "Up" state? |
| Health status | Does the healthcheck report healthy/unhealthy/starting? |
| Recent logs | Are there error patterns in the last 30 seconds of logs? |
| Port connectivity | Do exposed ports respond to TCP connections? |
| Traefik URLs | If configured via labels, is the URL reachable? |

**Example output:**
```
Health Checks
-------------
✅ 📦 myproject-web
    5 minutes
    ✅ healthy
    ✅ logs clean
    ✅ port 8080 responding

✅ 📦 myproject-db
    5 minutes
    ✅ healthy
    ✅ logs clean

❌ 📦 myproject-cache
    Exited (1)
    ⚠ no healthcheck configured
    ⚠ 2 error(s) in logs:
       connection refused to redis
       ... and 1 more

0 error(s), ⚠ 3 warning(s)
```

### Traefik URL Checks

If a container has Traefik labels with `Host()` rules but no exposed ports, mpm will check if the Traefik URL is reachable:

```
✅ 📦 myproject-api
    2 minutes
    ⚠ no healthcheck configured
    ✅ logs clean
    ✅ http://api.localhost reachable
```

mpm tries HTTP first, then HTTPS if HTTP fails.

## Check Output

Checks use emoji indicators:

| Symbol | Meaning |
|--------|---------|
| ✅ | Success - check passed |
| ⚠ | Warning - potential issue, deployment continues |
| ❌ | Error - critical issue |
| 📦 | Container indicator |

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
