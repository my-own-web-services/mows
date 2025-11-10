#!/usr/bin/env bash

# Verkehr Benchmark Matrix Runner
# Runs benchmarks with multiple load configurations

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Configuration
DURATION=${DURATION:-10s}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_header() {
    echo -e "${GREEN}=========================================${NC}"
    echo -e "${GREEN}$1${NC}"
    echo -e "${GREEN}=========================================${NC}"
}

print_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Step 1: Check Verkehr Image
print_header "Step 1: Checking Verkehr Image"

if docker image inspect localhost:5000/verkehr >/dev/null 2>&1; then
    print_info "Verkehr image already exists"
else
    print_error "Verkehr image not found. Please build it first."
    exit 1
fi

# Step 2: Start services
print_header "Step 2: Starting Docker Services"
print_info "Stopping any existing benchmark containers..."
docker compose -f docker-compose.bench.yml down -v 2>/dev/null || true

print_info "Starting benchmark services..."
docker compose -f docker-compose.bench.yml up -d

print_info "Waiting for services to be healthy..."

# Function to check if a container is running
check_container_running() {
    local container_name=$1
    local status=$(docker compose -f docker-compose.bench.yml ps -q "$container_name" 2>/dev/null | xargs docker inspect -f '{{.State.Running}}' 2>/dev/null)
    [ "$status" = "true" ]
}

# Wait for containers to be running (with timeout)
MAX_WAIT=60
ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT ]; do
    print_info "Checking service status (${ELAPSED}s/${MAX_WAIT}s)..."

    VERKEHR_RUNNING=false
    TRAEFIK_RUNNING=false

    if check_container_running "verkehr"; then
        VERKEHR_RUNNING=true
    fi

    if check_container_running "traefik"; then
        TRAEFIK_RUNNING=true
    fi

    if [ "$VERKEHR_RUNNING" = "true" ] && [ "$TRAEFIK_RUNNING" = "true" ]; then
        print_info "All services are running!"
        break
    fi

    if [ $ELAPSED -ge $MAX_WAIT ]; then
        print_error "Timeout waiting for services to start"
        if [ "$VERKEHR_RUNNING" != "true" ]; then
            print_error "Verkehr container not running"
            docker compose -f docker-compose.bench.yml logs verkehr
        fi
        if [ "$TRAEFIK_RUNNING" != "true" ]; then
            print_error "Traefik container not running"
            docker compose -f docker-compose.bench.yml logs traefik
        fi
        exit 1
    fi

    sleep 3
    ELAPSED=$((ELAPSED + 3))
done

# Give services a moment to fully initialize
sleep 5
print_info "Services are ready for benchmarking"

# Step 3: Run benchmark matrix
print_header "Step 3: Running Benchmark Matrix"
print_info "Duration per test: $DURATION"
print_info "This will test 5 different load configurations"

# Calculate estimated time (optional, skip if bc not available)
duration_secs=$(echo "$DURATION" | sed 's/s//')
if command -v bc &> /dev/null && [ -n "$duration_secs" ]; then
    total_mins=$(echo "scale=0; $duration_secs * 8 * 5 / 60" | bc 2>/dev/null)
    print_info "Total time: ~$duration_secs x 8 tests x 5 configs = ~$total_mins minutes"
else
    print_info "Total time: ~$duration_secs seconds per test x 8 tests x 5 configs"
fi
echo ""

# Ensure results directory exists
mkdir -p ./results

# Start memory monitoring in background
print_info "Starting memory monitoring..."
STOP_FLAG="/tmp/stop_memory_monitor_$$"
rm -f "$STOP_FLAG"
INTERVAL=2 OUTPUT_FILE="./results/memory_matrix_$(date +%Y%m%d_%H%M%S).csv" STOP_FLAG="$STOP_FLAG" \
    ./scripts/monitor-memory.sh > ./results/memory_monitor.log 2>&1 &
MONITOR_PID=$!
print_info "Memory monitor started (PID: $MONITOR_PID)"
sleep 2

# Run benchmarks
docker compose -f docker-compose.bench.yml exec -e DURATION=$DURATION wrk \
    sh /scripts/run-benchmark-matrix.sh

# Stop memory monitoring
print_info "Stopping memory monitor..."
touch "$STOP_FLAG"
wait "$MONITOR_PID" 2>/dev/null || true
cat ./results/memory_monitor.log
rm -f "$STOP_FLAG" ./results/memory_monitor.log

# Step 4: Analyze results
print_header "Step 4: Results Summary"
print_info "Detailed results saved in ./results/"
print_info "Generating comparison..."

# Simple comparison of results
echo ""
echo "Latest results by configuration:"
for config in light moderate standard high stress; do
    echo ""
    echo "=== $config ==="
    ls -t results/*_${config}_* 2>/dev/null | head -3 | while read file; do
        rps=$(grep "Requests/sec:" "$file" | awk '{print $2}')
        echo "  $(basename $file | cut -d'_' -f1-2): ${rps} RPS"
    done || echo "  No results found"
done

print_header "Benchmark Matrix Complete!"
echo ""
print_info "To analyze results, run: ./scripts/analyze-results.sh"
