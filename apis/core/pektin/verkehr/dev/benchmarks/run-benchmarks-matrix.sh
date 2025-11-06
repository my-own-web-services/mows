#!/bin/bash

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

if docker image inspect pektin/verkehr:latest >/dev/null 2>&1; then
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
sleep 15

# Check if services are running
if ! docker compose -f docker-compose.bench.yml ps | grep -q "bench-verkehr.*Up"; then
    print_error "Verkehr container not running"
    docker compose -f docker-compose.bench.yml logs verkehr
    exit 1
fi

if ! docker compose -f docker-compose.bench.yml ps | grep -q "bench-traefik.*Up"; then
    print_error "Traefik container not running"
    docker compose -f docker-compose.bench.yml logs traefik
    exit 1
fi

print_info "All services are running"

# Step 3: Run benchmark matrix
print_header "Step 3: Running Benchmark Matrix"
print_info "Duration per test: $DURATION"
print_info "This will test 5 different load configurations"
print_info "Total time: ~$(echo "$DURATION" | sed 's/s//') x 8 tests x 5 configs = ~$(echo "scale=0; $(echo "$DURATION" | sed 's/s//') * 8 * 5 / 60" | bc) minutes"
echo ""

docker compose -f docker-compose.bench.yml exec -e DURATION=$DURATION wrk \
    sh /scripts/run-benchmark-matrix.sh

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
