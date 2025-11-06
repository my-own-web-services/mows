#!/bin/sh
set -e

# Benchmark configuration matrix
DURATION=${DURATION:-10s}
OUTPUT_DIR="/results"

# Test configurations: threads,connections,name
CONFIGS="
1,10,light
2,50,moderate
4,100,standard
4,200,high
8,400,stress
"

# Function to run a single benchmark
run_bench() {
    name=$1
    url=$2
    proxy=$3
    header=$4
    threads=$5
    connections=$6
    config_name=$7

    output_file="${OUTPUT_DIR}/${proxy}_${name}_${config_name}_t${threads}_c${connections}_$(date +%Y%m%d_%H%M%S).txt"

    echo "Running: ${proxy}/${name} [${config_name}: ${threads}t/${connections}c]"

    # Run wrk with or without header
    if [ -n "$header" ]; then
        /usr/local/bin/wrk -t${threads} -c${connections} -d${DURATION} -H "${header}" "${url}" > "${output_file}" 2>&1
    else
        /usr/local/bin/wrk -t${threads} -c${connections} -d${DURATION} "${url}" > "${output_file}" 2>&1
    fi

    # Extract key metrics
    rps=$(grep "Requests/sec:" "${output_file}" | awk '{print $2}')
    latency_avg=$(grep "Latency" "${output_file}" | awk '{print $2}')
    errors=$(grep "Non-2xx or 3xx responses:" "${output_file}" | awk '{print $5}' || echo "0")

    printf "  %-15s RPS: %-12s Latency: %-10s" "${config_name}" "${rps}" "${latency_avg}"
    if [ "$errors" != "0" ] && [ -n "$errors" ]; then
        printf " ⚠️  Errors: %s" "${errors}"
    fi
    echo ""
}

# Main benchmark execution
echo "========================================="
echo "Verkehr Benchmark Matrix"
echo "========================================="
echo "Duration: ${DURATION}"
echo "Configurations:"
echo "  - light:    1 thread,  10 connections"
echo "  - moderate: 2 threads, 50 connections"
echo "  - standard: 4 threads, 100 connections"
echo "  - high:     4 threads, 200 connections"
echo "  - stress:   8 threads, 400 connections"
echo "========================================="
echo ""

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 5

# Parse and run each configuration
for line in $CONFIGS; do
    # Skip empty lines
    [ -z "$line" ] && continue

    threads=$(echo "$line" | cut -d',' -f1)
    connections=$(echo "$line" | cut -d',' -f2)
    config_name=$(echo "$line" | cut -d',' -f3)

    echo ""
    echo "=== Configuration: ${config_name} (${threads} threads, ${connections} connections) ==="
    echo ""

    # Verkehr tests
    echo "--- Verkehr ---"
    run_bench "whoami-host" "http://verkehr:8080/" "verkehr" "Host: whoami.localhost" "$threads" "$connections" "$config_name"
    run_bench "whoami-path" "http://verkehr:8080/whoami" "verkehr" "" "$threads" "$connections" "$config_name"
    run_bench "static-path" "http://verkehr:8080/static" "verkehr" "" "$threads" "$connections" "$config_name"

    # Traefik tests
    echo "--- Traefik ---"
    run_bench "whoami-host" "http://traefik:8081/" "traefik" "Host: whoami.localhost" "$threads" "$connections" "$config_name"
    run_bench "whoami-path" "http://traefik:8081/whoami" "traefik" "" "$threads" "$connections" "$config_name"
    run_bench "static-path" "http://traefik:8081/static" "traefik" "" "$threads" "$connections" "$config_name"

    # Baseline tests
    echo "--- Baseline ---"
    run_bench "whoami-direct" "http://whoami:80/" "baseline" "" "$threads" "$connections" "$config_name"
    run_bench "static-direct" "http://nginx-static:80/" "baseline" "" "$threads" "$connections" "$config_name"
done

echo ""
echo "========================================="
echo "Benchmark matrix completed!"
echo "Results saved to: ${OUTPUT_DIR}"
echo "========================================="
