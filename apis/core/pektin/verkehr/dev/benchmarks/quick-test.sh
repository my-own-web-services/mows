#!/bin/bash

# Quick benchmark test - runs a fast comparison between Verkehr and Traefik
# Useful for rapid iteration during development

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Quick test configuration (shorter duration for faster results)
DURATION=${DURATION:-30s}
THREADS=${THREADS:-8}
CONNECTIONS=${CONNECTIONS:-200}

echo "========================================="
echo "Quick Benchmark Test"
echo "========================================="
echo "This is a fast test for development."
echo "For production benchmarks, use run-benchmarks.sh"
echo ""
echo "Configuration:"
echo "  Duration: $DURATION"
echo "  Threads: $THREADS"
echo "  Connections: $CONNECTIONS"
echo "========================================="
echo ""

# Check if containers are running
if ! docker ps | grep -q "bench-verkehr"; then
    echo "Starting benchmark containers..."
    docker compose -f docker-compose.bench.yml up -d
    echo "Waiting for services to be ready..."
    sleep 10
fi

# Run a single quick test for both proxies
echo "Testing Verkehr..."
verkehr_result=$(docker compose -f docker-compose.bench.yml exec -T wrk sh -c \
    "wrk -t${THREADS} -c${CONNECTIONS} -d${DURATION} http://verkehr:8080/ -H 'Host: whoami.localhost'" \
    2>/dev/null | grep "Requests/sec:" | awk '{print $2}')

echo "Testing Traefik..."
traefik_result=$(docker compose -f docker-compose.bench.yml exec -T wrk sh -c \
    "wrk -t${THREADS} -c${CONNECTIONS} -d${DURATION} http://traefik:8081/ -H 'Host: whoami.localhost'" \
    2>/dev/null | grep "Requests/sec:" | awk '{print $2}')

echo "Testing Direct (Baseline)..."
baseline_result=$(docker compose -f docker-compose.bench.yml exec -T wrk sh -c \
    "wrk -t${THREADS} -c${CONNECTIONS} -d${DURATION} http://whoami:80/" \
    2>/dev/null | grep "Requests/sec:" | awk '{print $2}')

# Display results
echo ""
echo "========================================="
echo "Quick Test Results"
echo "========================================="
printf "%-15s %15s\n" "Proxy" "Requests/sec"
echo "---------------------------------"
printf "%-15s %15s\n" "Verkehr" "$verkehr_result"
printf "%-15s %15s\n" "Traefik" "$traefik_result"
printf "%-15s %15s\n" "Direct" "$baseline_result"
echo "========================================="

# Calculate differences
if command -v bc &> /dev/null; then
    verkehr_num=$(echo "$verkehr_result" | tr -d ',')
    traefik_num=$(echo "$traefik_result" | tr -d ',')
    baseline_num=$(echo "$baseline_result" | tr -d ',')

    if [ -n "$verkehr_num" ] && [ -n "$traefik_num" ] && [ "$traefik_num" != "0" ]; then
        diff=$(echo "scale=2; ($verkehr_num - $traefik_num) / $traefik_num * 100" | bc)
        echo ""
        echo "Verkehr vs Traefik: ${diff}%"
    fi

    if [ -n "$verkehr_num" ] && [ -n "$baseline_num" ] && [ "$baseline_num" != "0" ]; then
        overhead=$(echo "scale=2; ($baseline_num - $verkehr_num) / $baseline_num * 100" | bc)
        echo "Verkehr overhead: ${overhead}%"
    fi
fi

echo ""
echo "For comprehensive benchmarks, run: ./run-benchmarks.sh"
