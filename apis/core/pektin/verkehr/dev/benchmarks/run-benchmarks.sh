#!/bin/bash

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
if docker image inspect pektin/verkehr:latest >/dev/null 2>&1; then
    print_info "Verkehr image already exists, skipping build"
else
    print_info "Verkehr image not found. Please build it first:"
    print_info "  cd ../.. && docker build -t pektin/verkehr:latest ."
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
sleep 15
print_info "Checking service status..."

# Check if services are running
if ! docker ps | grep -q "bench-verkehr"; then
    print_error "Verkehr container not running"
    docker compose -f docker-compose.bench.yml logs verkehr
    exit 1
fi

if ! docker ps | grep -q "bench-traefik"; then
    print_error "Traefik container not running"
    docker compose -f docker-compose.bench.yml logs traefik
    exit 1
fi

print_info "All services are running"

# Step 3: Run benchmarks
print_header "Step 3: Running Benchmarks"
print_info "Configuration:"
print_info "  Duration: $DURATION"
print_info "  Threads: $THREADS"
print_info "  Connections: $CONNECTIONS"

docker compose -f docker-compose.bench.yml exec -e DURATION=$DURATION -e THREADS=$THREADS -e CONNECTIONS=$CONNECTIONS wrk \
    sh /scripts/run-benchmark.sh

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
