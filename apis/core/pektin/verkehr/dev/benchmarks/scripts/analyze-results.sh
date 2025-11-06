#!/bin/bash

# Analyze and compare benchmark results

RESULTS_DIR="/results"

# Function to extract metrics from wrk output
extract_metrics() {
    local file=$1
    local rps=$(grep "Requests/sec:" "$file" | awk '{print $2}' | tr -d ',')
    local latency_avg=$(grep "Latency" "$file" | awk '{print $2}')
    local transfer=$(grep "Transfer/sec:" "$file" | awk '{print $2}')

    echo "$rps|$latency_avg|$transfer"
}

# Find latest result files
echo "========================================="
echo "Benchmark Results Analysis"
echo "========================================="
echo ""

# Group results by scenario
declare -A verkehr_results
declare -A traefik_results
declare -A baseline_results

# Process all result files
for file in "$RESULTS_DIR"/*.txt; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")

        # Extract proxy type and scenario
        if [[ $filename =~ ^verkehr_(.+)_[0-9]+_[0-9]+\.txt$ ]]; then
            scenario="${BASH_REMATCH[1]}"
            verkehr_results[$scenario]=$(extract_metrics "$file")
        elif [[ $filename =~ ^traefik_(.+)_[0-9]+_[0-9]+\.txt$ ]]; then
            scenario="${BASH_REMATCH[1]}"
            traefik_results[$scenario]=$(extract_metrics "$file")
        elif [[ $filename =~ ^baseline_(.+)_[0-9]+_[0-9]+\.txt$ ]]; then
            scenario="${BASH_REMATCH[1]}"
            baseline_results[$scenario]=$(extract_metrics "$file")
        fi
    fi
done

# Print comparison table
printf "%-20s %-15s %-15s %-15s %-15s\n" "Scenario" "Verkehr RPS" "Traefik RPS" "Baseline RPS" "Verkehr vs Traefik"
echo "--------------------------------------------------------------------------------"

for scenario in "${!verkehr_results[@]}"; do
    verkehr_data="${verkehr_results[$scenario]}"
    traefik_data="${traefik_results[$scenario]:-||}}"
    baseline_data="${baseline_results[$scenario]:-||}}"

    verkehr_rps=$(echo "$verkehr_data" | cut -d'|' -f1)
    traefik_rps=$(echo "$traefik_data" | cut -d'|' -f1)
    baseline_rps=$(echo "$baseline_data" | cut -d'|' -f1)

    # Calculate percentage difference
    if [ -n "$verkehr_rps" ] && [ -n "$traefik_rps" ]; then
        diff=$(echo "scale=2; ($verkehr_rps - $traefik_rps) / $traefik_rps * 100" | bc 2>/dev/null || echo "N/A")
        diff_str="${diff}%"
    else
        diff_str="N/A"
    fi

    printf "%-20s %-15s %-15s %-15s %-15s\n" \
        "$scenario" \
        "${verkehr_rps:-N/A}" \
        "${traefik_rps:-N/A}" \
        "${baseline_rps:-N/A}" \
        "$diff_str"
done

echo ""
echo "========================================="
echo "Detailed Results"
echo "========================================="
echo ""

# Print detailed latency information
echo "Latency Comparison:"
echo "-------------------"
printf "%-20s %-15s %-15s\n" "Scenario" "Verkehr Latency" "Traefik Latency"

for scenario in "${!verkehr_results[@]}"; do
    verkehr_data="${verkehr_results[$scenario]}"
    traefik_data="${traefik_results[$scenario]:-||}}"

    verkehr_lat=$(echo "$verkehr_data" | cut -d'|' -f2)
    traefik_lat=$(echo "$traefik_data" | cut -d'|' -f2)

    printf "%-20s %-15s %-15s\n" \
        "$scenario" \
        "${verkehr_lat:-N/A}" \
        "${traefik_lat:-N/A}"
done

echo ""
echo "All result files are available in: $RESULTS_DIR"
