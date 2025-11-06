# Verkehr Benchmark Suite

A comprehensive benchmarking suite for testing Verkehr's performance against Traefik and baseline (direct) connections.

## Overview

This benchmark suite provides:
- **Automated testing** of Verkehr vs Traefik performance
- **Multiple test scenarios** (host-based, path-based, regex routing)
- **Baseline comparisons** (direct connection to backends)
- **Automated result collection and analysis**
- **Reproducible testing environment** using Docker Compose

## Architecture

```
Container Network (bench)
┌───────────────────────────────────────────────────────┐
│                                                       │
│  ┌─────────────┐                                    │
│  │   wrk       │  Load Generator                    │
│  │ (LoadGen)   │                                    │
│  └──────┬──────┘                                    │
│         │                                            │
│         ├──────────────────┐                        │
│         │                  │                        │
│         ▼                  ▼                        │
│  ┌─────────────┐    ┌─────────────┐               │
│  │  Verkehr    │    │  Traefik    │  Proxies      │
│  │  :8080      │    │  :8081      │               │
│  └──────┬──────┘    └──────┬──────┘               │
│         │                  │                        │
│         └────────┬─────────┘                        │
│                  │                                   │
│          ┌───────┴────────┐                         │
│          │                │                         │
│          ▼                ▼                         │
│     ┌─────────┐      ┌──────────┐                  │
│     │ whoami  │      │  nginx   │  Backends        │
│     │  :80    │      │  :80     │                  │
│     └─────────┘      └──────────┘                  │
│                                                       │
└───────────────────────────────────────────────────────┘

Note: No ports exposed to host - all testing happens
inside the container network for maximum performance
and no port conflicts.
```

## Prerequisites

- Docker and Docker Compose
- `wrk` HTTP benchmarking tool (included in container)
- At least 2GB of free RAM
- Linux/macOS (Windows WSL2 should work but is untested)
- **Verkehr Docker image** (see below)

## Quick Start

**Important:** Build Verkehr first (if not already built):
```bash
cd /home/paul/projects/mows/apis/core/pektin/verkehr
./build.sh  # Or your usual build method

# Verify image exists
docker images | grep verkehr
```

**Run benchmarks:**
```bash
cd dev/benchmarks

# Quick test (5 seconds)
./quick-test.sh

# Full benchmark suite
./run-benchmarks.sh
```

**View results:**
```bash
ls -lh results/
cat results/verkehr_whoami-host_*.txt
```

## Test Scenarios

The benchmark suite tests the following scenarios:

### 1. Host-Based Routing
- **Rule:** `Host(whoami.localhost)` / `Host(static.localhost)`
- **Description:** Routes requests based on the Host header
- **Tests:** Simple hostname matching performance

### 2. Path-Based Routing
- **Rule:** `PathPrefix(/whoami)` / `PathPrefix(/static)`
- **Description:** Routes requests based on URL path
- **Tests:** Path matching and prefix routing performance

### 3. Regex Routing
- **Rule:** `HostRegexp(^whoami.*\.localhost$)`
- **Description:** Routes using regular expressions
- **Tests:** Complex pattern matching performance

### 4. Static Content
- **Backend:** Nginx serving static HTML
- **Description:** Tests proxy overhead with minimal backend processing
- **Tests:** Pure proxy throughput

### 5. Dynamic Content
- **Backend:** Traefik whoami service
- **Description:** Tests proxy with dynamic backend responses
- **Tests:** Real-world scenario performance

### 6. Baseline (Direct)
- **Description:** Direct connection to backend services without proxy
- **Tests:** Reference point for proxy overhead calculation

## Configuration

### Benchmark Parameters

You can customize the benchmark parameters using environment variables:

```bash
# Run benchmarks with custom settings
DURATION=30s THREADS=8 CONNECTIONS=200 ./run-benchmarks.sh
```

Available parameters:
- `DURATION`: Test duration (default: `10s`)
- `THREADS`: Number of threads (default: `4`)
- `CONNECTIONS`: Number of concurrent connections (default: `100`)

### Proxy Configuration

#### Verkehr Configuration
- **Main config:** `configs/verkehr.yml`
- **Routing config:** `configs/verkehr-routing.yml`

#### Traefik Configuration
- **Static config:** `configs/traefik-static.yml`
- **Dynamic config:** `configs/traefik-dynamic.yml`

## Manual Testing

### Start the environment

```bash
docker compose -f docker-compose.bench.yml up -d
```

### Run a specific benchmark

```bash
# Benchmark Verkehr with custom settings
docker compose -f docker-compose.bench.yml exec wrk \
  wrk -t4 -c100 -d10s http://verkehr:8080/ -H 'Host: whoami.localhost'

# Benchmark Traefik
docker compose -f docker-compose.bench.yml exec wrk \
  wrk -t4 -c100 -d10s http://traefik:8081/ -H 'Host: whoami.localhost'

# Baseline test (direct to backend)
docker compose -f docker-compose.bench.yml exec wrk \
  wrk -t4 -c100 -d10s http://whoami:80/
```

### View logs

```bash
# Verkehr logs
docker compose -f docker-compose.bench.yml logs -f verkehr

# Traefik logs
docker compose -f docker-compose.bench.yml logs -f traefik
```

### Expose ports for debugging (optional)

By default, no ports are exposed to avoid conflicts. If you want to access the proxies or dashboards from your host machine:

```bash
# Start with exposed ports
docker compose -f docker-compose.bench.yml -f docker-compose.expose-ports.yml up -d

# Then access:
# - Verkehr: http://localhost:8080
# - Traefik: http://localhost:8081
# - Traefik Dashboard: http://localhost:8091
# - Verkehr API: http://localhost:9090
# - Whoami (direct): http://localhost:8092
# - Nginx (direct): http://localhost:8093
```

### Stop the environment

```bash
docker compose -f docker-compose.bench.yml down
```

## Results

Results are saved in the `results/` directory with the following naming convention:
```
{proxy}_{scenario}_{timestamp}.txt
```

Example:
```
verkehr_whoami-host_20241105_153045.txt
traefik_whoami-host_20241105_153055.txt
baseline_whoami-direct_20241105_153105.txt
```

### Understanding Results

Each result file contains output from `wrk` including:

```
Running 10s test @ http://verkehr:8080/
  4 threads and 100 connections
  Thread Stats   Avg      Stdev     Max   +/- Stdev
    Latency     1.14ms   2.42us   5.55ms   85.65%
    Req/Sec   177.67k     2.88k  191.55k    71.71%
  7123930 requests in 10.10s, 597.86MB read
Requests/sec: 705343.03
Transfer/sec:     59.19MB
```

Key metrics:
- **Requests/sec:** Throughput (higher is better)
- **Latency (Avg):** Average request latency (lower is better)
- **Transfer/sec:** Network throughput

### Analysis Script

The analysis script (`scripts/analyze-results.sh`) automatically:
1. Parses all result files
2. Groups results by scenario
3. Compares Verkehr vs Traefik performance
4. Calculates percentage differences
5. Displays a comparison table

Example output:
```
Scenario             Verkehr RPS     Traefik RPS     Baseline RPS    Verkehr vs Traefik
--------------------------------------------------------------------------------
whoami-host          705343.03       567890.12       812345.67       +24.21%
whoami-path          698234.56       543210.98       812345.67       +28.53%
static-host          1250684.34      987654.32       1523456.78      +26.62%
```

## Interpreting Results

### What to Look For

1. **Requests per Second (RPS)**
   - Higher is better
   - Compare Verkehr vs Traefik to see relative performance
   - Compare to baseline to understand proxy overhead

2. **Latency**
   - Lower is better
   - Average latency should be consistent across runs
   - Check standard deviation for consistency

3. **Proxy Overhead**
   ```
   Overhead % = ((Baseline RPS - Proxy RPS) / Baseline RPS) * 100
   ```
   - Lower overhead is better
   - Typically 5-30% for well-optimized proxies

### Historical Results

The original benchmarks from `benchmarks.md` showed:

| Test | RPS | Notes |
|------|-----|-------|
| Hyper (Hello World) | 705,343 | Pure Hyper baseline |
| Direct to whoami | 40,990 | Backend baseline |
| Traefik → whoami | 29,725 | ~27% overhead |
| Hyper → whoami | 35,068 | ~14% overhead |
| Direct to pektin/ui | 250,446 | Backend baseline |
| Traefik → pektin/ui | 49,833 | ~80% overhead |
| Hyper → pektin/ui | 125,068 | ~50% overhead |

## Continuous Benchmarking

### Running Regular Benchmarks

You can set up regular benchmarking using cron:

```bash
# Add to crontab (runs daily at 2 AM)
0 2 * * * cd /path/to/verkehr/dev/benchmarks && ./run-benchmarks.sh >> /var/log/verkehr-bench.log 2>&1
```

### Comparing Results Over Time

```bash
# List all results chronologically
ls -lt results/

# Compare specific test runs
diff results/verkehr_whoami-host_20241105_120000.txt \
     results/verkehr_whoami-host_20241106_120000.txt
```

## Troubleshooting

### Port already in use errors

**This should not happen** with the default configuration since no ports are exposed to the host. If you see port conflicts:

1. You may have old containers running: `docker ps` and `docker stop <container>`
2. You're using `docker-compose.expose-ports.yml` - this is optional and only for debugging
3. Stop and restart: `docker compose -f docker-compose.bench.yml down && ./quick-test.sh`

### Services won't start

```bash
# Check logs
docker compose -f docker-compose.bench.yml logs

# Check specific service
docker compose -f docker-compose.bench.yml logs verkehr

# Rebuild Verkehr image
docker build -t pektin/verkehr:latest -f ../../Dockerfile ../../
```

### Low performance / inconsistent results

1. **System resources:** Ensure adequate CPU and RAM
2. **Background processes:** Close unnecessary applications
3. **Docker resources:** Increase Docker memory limits
4. **Network:** Use bridge network mode (default)
5. **Isolation:** All containers run in isolated network - no host interference

### Container not found errors

```bash
# Ensure all services are running
docker compose -f docker-compose.bench.yml ps

# Restart services
docker compose -f docker-compose.bench.yml restart

# Full reset
docker compose -f docker-compose.bench.yml down -v
docker compose -f docker-compose.bench.yml up -d
```

## Advanced Usage

### Custom Test Scenarios

Add new routes to the configuration files:

1. Edit `configs/verkehr-routing.yml` (for Verkehr)
2. Edit `configs/traefik-dynamic.yml` (for Traefik)
3. Restart services: `docker compose -f docker-compose.bench.yml restart`
4. Run benchmarks manually or modify `scripts/run-benchmark.sh`

### Testing with TLS

To test HTTPS performance:

1. Generate test certificates (see `../../certs/` directory)
2. Update entrypoint configurations to use port 8443 (websecure)
3. Uncomment TLS sections in routing configs
4. Update benchmark URLs to use `https://`

### Resource Monitoring

Monitor resource usage during benchmarks:

```bash
# CPU and memory usage
docker stats

# Network throughput
docker compose -f docker-compose.bench.yml exec verkehr \
  cat /proc/net/dev
```

## Contributing

To add new test scenarios:

1. Add backend service to `docker-compose.bench.yml`
2. Add routing rules to both Verkehr and Traefik configs
3. Add test case to `scripts/run-benchmark.sh`
4. Update this README with the new scenario

## Files Overview

```
benchmarks/
├── README.md                          # This file
├── run-benchmarks.sh                  # Main orchestration script
├── docker-compose.bench.yml           # Docker Compose setup
├── configs/                           # Configuration files
│   ├── verkehr.yml                   # Verkehr main config
│   ├── verkehr-routing.yml           # Verkehr routing rules
│   ├── traefik-static.yml            # Traefik static config
│   └── traefik-dynamic.yml           # Traefik dynamic config
├── scripts/                          # Helper scripts
│   ├── run-benchmark.sh              # Benchmark runner (inside container)
│   └── analyze-results.sh            # Results analysis
├── static-content/                   # Static files for nginx
│   └── index.html                    # Simple test page
└── results/                          # Benchmark results (generated)
    └── *.txt                         # Individual test results
```

## License

Same as Verkehr project.
