#!/usr/bin/env bash
# Pull the canonical EXPLAIN ANALYZE timings per benchmark.
#
# The bench scripts always run their query 3-4× then EXPLAIN ANALYZE
# the same query. The EXPLAIN reports Planning + Execution time —
# those are the numbers we report.

set -euo pipefail
cd "$(dirname "$0")/.."

INPUT="${1:?usage: summarize-results.sh <results/file.md>}"

awk '
/^## .*\.sql$/             { bench = $2; section = bench; next }
/^=== / {
    # Sub-section label inside a single bench file (e.g.
    # "=== (A) without cover ===")
    sub_label = substr($0, 5, length($0) - 8)
    section = bench " :: " sub_label
    next
}
/^ Planning Time: / {
    planning[section] = $3
    next
}
/^ Execution Time: / {
    exec_time[section] = $3
    seq[++n] = section
    next
}
END {
    printf "%-65s | %-12s | %-12s | %s\n", "scenario", "planning_ms", "exec_ms", "total_ms"
    print "-------------------------------------------------------------------------------------------------------"
    seen = ""
    for (i = 1; i <= n; i++) {
        s = seq[i]
        if (index(seen, "|" s "|")) continue
        seen = seen "|" s "|"
        p = planning[s] + 0
        e = exec_time[s] + 0
        printf "%-65s | %-12.3f | %-12.3f | %.3f\n", s, p, e, p + e
    }
}' "$INPUT"
