#!/usr/bin/env bash

# Analyze and compare benchmark results

# Determine results directory based on where script is run
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -d "$SCRIPT_DIR/../results" ]; then
    RESULTS_DIR="$SCRIPT_DIR/../results"
elif [ -d "/results" ]; then
    RESULTS_DIR="/results"
else
    RESULTS_DIR="./results"
fi

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

# Check if results directory exists and has files
if [ ! -d "$RESULTS_DIR" ]; then
    echo "Error: Results directory not found: $RESULTS_DIR"
    exit 1
fi

# Count result files
result_count=$(find "$RESULTS_DIR" -name "*.txt" 2>/dev/null | wc -l)
if [ "$result_count" -eq 0 ]; then
    echo "No result files found in: $RESULTS_DIR"
    echo "Run benchmarks first to generate results."
    exit 0
fi

echo "Found $result_count result file(s) in: $RESULTS_DIR"
echo ""

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

    # Calculate percentage difference using awk
    if [ -n "$verkehr_rps" ] && [ -n "$traefik_rps" ] && [ "$traefik_rps" != "0" ]; then
        diff=$(awk -v v="$verkehr_rps" -v t="$traefik_rps" 'BEGIN {printf "%.2f", ((v - t) / t * 100)}' 2>/dev/null)
        if [ -n "$diff" ]; then
            diff_str="${diff}%"
        else
            diff_str="N/A"
        fi
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

# Memory usage analysis
echo "========================================="
echo "Memory Usage Statistics"
echo "========================================="
echo ""

# Find the latest memory CSV file
MEMORY_FILE=$(ls -t "$RESULTS_DIR"/memory_*.csv 2>/dev/null | head -1)

if [ -f "$MEMORY_FILE" ]; then
    echo "Data from: $(basename "$MEMORY_FILE")"
    echo ""

    # Calculate statistics
    verkehr_stats=$(tail -n +2 "$MEMORY_FILE" | awk -F',' '{
        sum+=$2
        if(NR==1 || $2<min) min=$2
        if(NR==1 || $2>max) max=$2
    } END {
        printf "%.1f,%.1f,%.1f", min, max, sum/NR
    }')

    traefik_stats=$(tail -n +2 "$MEMORY_FILE" | awk -F',' '{
        sum+=$3
        if(NR==1 || $3<min) min=$3
        if(NR==1 || $3>max) max=$3
    } END {
        printf "%.1f,%.1f,%.1f", min, max, sum/NR
    }')

    verkehr_min=$(echo "$verkehr_stats" | cut -d',' -f1)
    verkehr_max=$(echo "$verkehr_stats" | cut -d',' -f2)
    verkehr_avg=$(echo "$verkehr_stats" | cut -d',' -f3)

    traefik_min=$(echo "$traefik_stats" | cut -d',' -f1)
    traefik_max=$(echo "$traefik_stats" | cut -d',' -f2)
    traefik_avg=$(echo "$traefik_stats" | cut -d',' -f3)

    printf "%-15s %10s %10s %10s\n" "Proxy" "Min (MB)" "Max (MB)" "Avg (MB)"
    echo "------------------------------------------------------"
    printf "%-15s %10s %10s %10s\n" "Verkehr" "$verkehr_min" "$verkehr_max" "$verkehr_avg"
    printf "%-15s %10s %10s %10s\n" "Traefik" "$traefik_min" "$traefik_max" "$traefik_avg"

    # Calculate difference using awk
    if [ -n "$verkehr_avg" ] && [ -n "$traefik_avg" ] && [ "$traefik_avg" != "0" ]; then
        mem_diff=$(awk -v v="$verkehr_avg" -v t="$traefik_avg" 'BEGIN {printf "%.2f", ((v - t) / t * 100)}' 2>/dev/null)
        if [ -n "$mem_diff" ]; then
            echo ""
            if awk "BEGIN {exit !($mem_diff >= 0)}"; then
                printf "Verkehr vs Traefik memory: +%.2f%%\n" "$mem_diff"
            else
                printf "Verkehr vs Traefik memory: %.2f%%\n" "$mem_diff"
            fi
        fi
    fi
else
    echo "No memory monitoring data found"
    echo "Memory statistics are collected automatically during benchmark runs"
fi

echo ""
echo "All result files are available in: $RESULTS_DIR"
