#!/bin/sh
set -e

# Benchmark configuration
DURATION=${DURATION:-10s}
THREADS=${THREADS:-4}
CONNECTIONS=${CONNECTIONS:-100}
OUTPUT_DIR="/results"

# Function to run a single benchmark
# Usage: run_bench <name> <url> <proxy> [header]
run_bench() {
    name=$1
    url=$2
    proxy=$3
    header=$4
    output_file="${OUTPUT_DIR}/${proxy}_${name}_$(date +%Y%m%d_%H%M%S).txt"

    echo "Running benchmark: ${proxy} - ${name}"
    echo "URL: ${url}"
    if [ -n "$header" ]; then
        echo "Header: ${header}"
    fi
    echo "Output: ${output_file}"

    # Run wrk with or without header
    if [ -n "$header" ]; then
        /usr/local/bin/wrk -t${THREADS} -c${CONNECTIONS} -d${DURATION} -H "${header}" "${url}" > "${output_file}" 2>&1
    else
        /usr/local/bin/wrk -t${THREADS} -c${CONNECTIONS} -d${DURATION} "${url}" > "${output_file}" 2>&1
    fi

    # Extract key metrics
    rps=$(grep "Requests/sec:" "${output_file}" | awk '{print $2}')
    latency_avg=$(grep "Latency" "${output_file}" | awk '{print $2}')
    errors=$(grep "Non-2xx or 3xx responses:" "${output_file}" | awk '{print $5}' || echo "0")

    echo "  RPS: ${rps}"
    echo "  Avg Latency: ${latency_avg}"
    if [ "$errors" != "0" ] && [ -n "$errors" ]; then
        echo "  ⚠️  Errors: ${errors}"
    fi
    echo ""
}

# Main benchmark execution
echo "========================================="
echo "Starting Verkehr Benchmark Suite"
echo "========================================="
echo "Duration: ${DURATION}"
echo "Threads: ${THREADS}"
echo "Connections: ${CONNECTIONS}"
echo "========================================="
echo ""

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 5

# Run benchmarks for Verkehr
echo "=== Verkehr Benchmarks ==="
run_bench "whoami-host" "http://verkehr:8080/" "verkehr" "Host: whoami.localhost"
run_bench "whoami-path" "http://verkehr:8080/whoami" "verkehr"
run_bench "static-host" "http://verkehr:8080/" "verkehr" "Host: static.localhost"
run_bench "static-path" "http://verkehr:8080/static" "verkehr"

# Run benchmarks for Traefik
echo "=== Traefik Benchmarks ==="
run_bench "whoami-host" "http://traefik:8081/" "traefik" "Host: whoami.localhost"
run_bench "whoami-path" "http://traefik:8081/whoami" "traefik"
run_bench "static-host" "http://traefik:8081/" "traefik" "Host: static.localhost"
run_bench "static-path" "http://traefik:8081/static" "traefik"

# Run baseline benchmarks (direct to backend)
echo "=== Baseline Benchmarks (No Proxy) ==="
run_bench "whoami-direct" "http://whoami:80/" "baseline"
run_bench "static-direct" "http://nginx-static:80/" "baseline"

echo "========================================="
echo "Benchmark suite completed!"
echo "Results saved to: ${OUTPUT_DIR}"
echo "========================================="
