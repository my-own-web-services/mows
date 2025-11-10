#!/usr/bin/env bash

# Verkehr Benchmark Runner
# This script orchestrates the complete benchmarking process

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Configuration
DURATION=${DURATION:-10s}
THREADS=${THREADS:-4}
CONNECTIONS=${CONNECTIONS:-100}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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

# Step 1: Check/Build Verkehr
print_header "Step 1: Checking Verkehr Image"

# Check if verkehr image exists
if docker image inspect localhost:5000/verkehr >/dev/null 2>&1; then
    print_info "Verkehr image already exists, skipping build"
else
    print_info "Verkehr image not found. Please build it first:"
    print_info "  cd ../.. && docker build -t localhost:5000/verkehr ."
    print_info ""
    print_info "Or if you have a working build script:"
    print_info "  cd ../.. && ./build.sh"
    print_info ""
    print_error "Cannot proceed without Verkehr image"
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

# Step 3: Run benchmarks
print_header "Step 3: Running Benchmarks"
print_info "Configuration:"
print_info "  Duration: $DURATION"
print_info "  Threads: $THREADS"
print_info "  Connections: $CONNECTIONS"

# Ensure results directory exists
mkdir -p ./results

# Start memory monitoring in background
print_info "Starting memory monitoring..."
STOP_FLAG="/tmp/stop_memory_monitor_$$"
rm -f "$STOP_FLAG"
INTERVAL=2 OUTPUT_FILE="./results/memory_$(date +%Y%m%d_%H%M%S).csv" STOP_FLAG="$STOP_FLAG" \
    ./scripts/monitor-memory.sh > ./results/memory_monitor.log 2>&1 &
MONITOR_PID=$!
print_info "Memory monitor started (PID: $MONITOR_PID)"
sleep 2

# Run benchmarks
docker compose -f docker-compose.bench.yml exec -e DURATION=$DURATION -e THREADS=$THREADS -e CONNECTIONS=$CONNECTIONS wrk \
    sh /scripts/run-benchmark.sh

# Stop memory monitoring
print_info "Stopping memory monitor..."
touch "$STOP_FLAG"
wait "$MONITOR_PID" 2>/dev/null || true
cat ./results/memory_monitor.log
rm -f "$STOP_FLAG" ./results/memory_monitor.log

# Step 4: Analyze results
print_header "Step 4: Analyzing Results"
if [ -f "./scripts/analyze-results.sh" ]; then
    ./scripts/analyze-results.sh
else
    print_info "Results saved in ./results/"
    print_info "Latest results:"
    ls -lth ./results/ | head -n 10
fi

# Step 5: Cleanup (optional)
print_header "Step 5: Cleanup"
read -p "Do you want to stop the benchmark containers? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Stopping benchmark services..."
    docker compose -f docker-compose.bench.yml down
else
    print_info "Containers are still running. You can inspect them with:"
    echo "  docker compose -f docker-compose.bench.yml logs"
    echo "To stop them later, run:"
    echo "  docker compose -f docker-compose.bench.yml down"
fi

print_header "Benchmark Complete!"
