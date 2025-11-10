#!/usr/bin/env bash

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

# Function to check if a container is running
check_container_running() {
    local container_name=$1
    local status=$(docker compose -f docker-compose.bench.yml ps -q "$container_name" 2>/dev/null | xargs docker inspect -f '{{.State.Running}}' 2>/dev/null)
    [ "$status" = "true" ]
}

# Check if containers are running
if ! check_container_running "verkehr" || ! check_container_running "traefik"; then
    echo "Starting benchmark containers..."
    docker compose -f docker-compose.bench.yml up -d
    echo "Waiting for services to be ready..."

    # Wait up to 60 seconds for services to start
    MAX_WAIT=60
    ELAPSED=0
    while [ $ELAPSED -lt $MAX_WAIT ]; do
        if check_container_running "verkehr" && check_container_running "traefik"; then
            echo "Services are ready!"
            break
        fi
        echo "Waiting for services... (${ELAPSED}s/${MAX_WAIT}s)"
        sleep 3
        ELAPSED=$((ELAPSED + 3))
    done

    if [ $ELAPSED -ge $MAX_WAIT ]; then
        echo "ERROR: Services failed to start in time"
        docker compose -f docker-compose.bench.yml logs
        exit 1
    fi

    # Give services extra time to fully initialize
    sleep 5
fi

# Start memory monitoring in background
echo "Starting memory monitoring..."
mkdir -p ./results
STOP_FLAG="/tmp/stop_memory_monitor_$$"
rm -f "$STOP_FLAG"
INTERVAL=1 OUTPUT_FILE="./results/memory_quicktest_$(date +%Y%m%d_%H%M%S).csv" STOP_FLAG="$STOP_FLAG" \
    ./scripts/monitor-memory.sh > /dev/null 2>&1 &
MONITOR_PID=$!
sleep 1

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

# Stop memory monitoring
touch "$STOP_FLAG"
wait "$MONITOR_PID" 2>/dev/null || true

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

# Calculate differences using awk
verkehr_num=$(echo "$verkehr_result" | tr -d ',')
traefik_num=$(echo "$traefik_result" | tr -d ',')
baseline_num=$(echo "$baseline_result" | tr -d ',')

if [ -n "$verkehr_num" ] && [ -n "$traefik_num" ] && [ "$traefik_num" != "0" ]; then
    diff=$(awk -v v="$verkehr_num" -v t="$traefik_num" 'BEGIN {printf "%.2f", ((v - t) / t * 100)}')
    echo ""
    echo "Verkehr vs Traefik: ${diff}%"
fi

if [ -n "$verkehr_num" ] && [ -n "$baseline_num" ] && [ "$baseline_num" != "0" ]; then
    overhead=$(awk -v b="$baseline_num" -v v="$verkehr_num" 'BEGIN {printf "%.2f", ((b - v) / b * 100)}')
    echo "Verkehr overhead: ${overhead}%"
fi

# Display memory stats
echo ""
echo "========================================="
echo "Memory Usage"
echo "========================================="
MEMORY_FILE=$(ls -t ./results/memory_quicktest_*.csv 2>/dev/null | head -1)
if [ -f "$MEMORY_FILE" ]; then
    verkehr_mem=$(tail -n +2 "$MEMORY_FILE" | awk -F',' '{sum+=$2} END {printf "%.1f", sum/NR}')
    traefik_mem=$(tail -n +2 "$MEMORY_FILE" | awk -F',' '{sum+=$3} END {printf "%.1f", sum/NR}')
    printf "%-15s %15s\n" "Proxy" "Avg Memory (MB)"
    echo "---------------------------------"
    printf "%-15s %15s\n" "Verkehr" "$verkehr_mem"
    printf "%-15s %15s\n" "Traefik" "$traefik_mem"

    if [ -n "$verkehr_mem" ] && [ -n "$traefik_mem" ] && [ "$traefik_mem" != "0" ]; then
        mem_diff=$(awk -v v="$verkehr_mem" -v t="$traefik_mem" 'BEGIN {printf "%.2f", ((v - t) / t * 100)}')
        echo ""
        echo "Verkehr vs Traefik memory: ${mem_diff}%"
    fi
else
    echo "Memory stats not available"
fi
echo "========================================="

rm -f "$STOP_FLAG"

echo ""
echo "For comprehensive benchmarks, run: ./run-benchmarks.sh"
