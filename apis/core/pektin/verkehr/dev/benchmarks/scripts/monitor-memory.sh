#!/usr/bin/env bash

# Memory monitoring script for benchmark containers
# Samples memory usage at regular intervals and saves to file

set -euo pipefail

INTERVAL=${INTERVAL:-2}  # Sample every 2 seconds
OUTPUT_FILE=${OUTPUT_FILE:-"./results/memory_$(date +%Y%m%d_%H%M%S).csv"}
STOP_FLAG=${STOP_FLAG:-"/tmp/stop_memory_monitor"}

# Remove stop flag if it exists
rm -f "$STOP_FLAG"

# Create CSV header
echo "timestamp,verkehr_mem_mb,traefik_mem_mb" > "$OUTPUT_FILE"

echo "Memory monitoring started (interval: ${INTERVAL}s)"
echo "Output: $OUTPUT_FILE"
echo "To stop monitoring: touch $STOP_FLAG"

# Function to get container memory in MB
get_memory_mb() {
    local container_name=$1
    # docker stats --no-stream returns memory usage
    local mem_usage=$(docker stats --no-stream --format "{{.MemUsage}}" "$container_name" 2>/dev/null | awk '{print $1}')

    if [ -z "$mem_usage" ]; then
        echo "0"
        return
    fi

    # Use awk to parse and convert memory values
    echo "$mem_usage" | awk '
    {
        value = $1
        gsub(/[^0-9.]/, "", value)

        if ($1 ~ /GiB$/) {
            printf "%.1f", value * 1024
        } else if ($1 ~ /MiB$/) {
            printf "%.1f", value
        } else if ($1 ~ /KiB$/) {
            printf "%.1f", value / 1024
        } else {
            print "0"
        }
    }'
}

# Monitor loop
while [ ! -f "$STOP_FLAG" ]; do
    timestamp=$(date +%Y-%m-%d_%H:%M:%S)

    verkehr_mem=$(get_memory_mb "bench-verkehr")
    traefik_mem=$(get_memory_mb "bench-traefik")

    # Only log if we got valid values
    if [ "$verkehr_mem" != "0" ] || [ "$traefik_mem" != "0" ]; then
        echo "$timestamp,$verkehr_mem,$traefik_mem" >> "$OUTPUT_FILE"
        printf "\r[%s] Verkehr: %6.1f MB | Traefik: %6.1f MB" "$timestamp" "$verkehr_mem" "$traefik_mem"
    fi

    sleep "$INTERVAL"
done

echo ""
echo "Memory monitoring stopped"

# Calculate statistics
if [ -f "$OUTPUT_FILE" ]; then
    echo ""
    echo "=== Memory Usage Statistics ==="

    # Skip header, calculate stats for verkehr
    verkehr_stats=$(tail -n +2 "$OUTPUT_FILE" | awk -F',' '{sum+=$2; if(NR==1 || $2<min) min=$2; if(NR==1 || $2>max) max=$2} END {print min","max","sum/NR}')
    verkehr_min=$(echo "$verkehr_stats" | cut -d',' -f1)
    verkehr_max=$(echo "$verkehr_stats" | cut -d',' -f2)
    verkehr_avg=$(echo "$verkehr_stats" | cut -d',' -f3)

    # Calculate stats for traefik
    traefik_stats=$(tail -n +2 "$OUTPUT_FILE" | awk -F',' '{sum+=$3; if(NR==1 || $3<min) min=$3; if(NR==1 || $3>max) max=$3} END {print min","max","sum/NR}')
    traefik_min=$(echo "$traefik_stats" | cut -d',' -f1)
    traefik_max=$(echo "$traefik_stats" | cut -d',' -f2)
    traefik_avg=$(echo "$traefik_stats" | cut -d',' -f3)

    printf "\nVerkehr:  Min: %6.1f MB | Max: %6.1f MB | Avg: %6.1f MB\n" "$verkehr_min" "$verkehr_max" "$verkehr_avg"
    printf "Traefik:  Min: %6.1f MB | Max: %6.1f MB | Avg: %6.1f MB\n" "$traefik_min" "$traefik_max" "$traefik_avg"

    # Calculate percentage difference using awk
    diff=$(awk -v v="$verkehr_avg" -v t="$traefik_avg" 'BEGIN {
        if (t != 0) printf "%.2f", ((v - t) / t * 100)
        else print "N/A"
    }')

    if [ "$diff" != "N/A" ]; then
        printf "\nVerkehr vs Traefik: %+s%% memory usage\n" "$diff"
    fi

    echo ""
    echo "Detailed data saved to: $OUTPUT_FILE"
fi
