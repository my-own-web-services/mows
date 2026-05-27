#!/usr/bin/env bash
# Runs inside the treeshake container. The host bind-mounts the library
# tarball at /lib/tarball.tgz and an empty output directory at /out.
# Builds every scenario sequentially and writes /out/sizes.json with
# per-scenario byte totals (raw + gzip).
set -euo pipefail

TARBALL=${TARBALL:-/lib/tarball.tgz}
OUT=${OUT:-/out}
SCENARIOS=(empty button codeViewer resourceList)

if [[ ! -f "$TARBALL" ]]; then
    echo "treeshake: $TARBALL not found — did you forget the bind mount?" >&2
    exit 2
fi

cd /work/consumer

# Install the freshly-packed lib on top of the pre-installed consumer deps.
# `pnpm add` updates package.json but the in-container state is throwaway,
# so the diff doesn't matter.
pnpm add --ignore-scripts "$TARBALL" >/dev/null

printf '{\n  "scenarios": {' > "$OUT/sizes.json"
first=1
for scenario in "${SCENARIOS[@]}"; do
    echo "treeshake: building scenario=$scenario" >&2
    SCENARIO="$scenario" pnpm run build >/dev/null

    scen_dir="dist/$scenario"
    if [[ ! -d "$scen_dir" ]]; then
        echo "treeshake: $scen_dir not found after build" >&2
        exit 3
    fi

    # Three buckets per scenario:
    #
    #   eager     — what index.html DIRECTLY references via <script>,
    #               <link rel="modulepreload">, <link rel="stylesheet">.
    #               This is the first-paint cost: every byte here is
    #               downloaded before the page becomes interactive.
    #               Tree-shaking AND code-splitting both shrink this.
    #
    #   reachable — eager + every chunk eventually fetched by
    #               following JS-internal filename references
    #               (dynamic-import targets, late-loaded chunks).
    #               This is "everything the consumer might download
    #               during the session" — bigger than `eager`, but
    #               excluding orphan assets nothing references.
    #               If reachable >> eager, code splitting is working.
    #
    #   total     — every file Vite emitted under dist/, including
    #               orphan assets. Signals stray bytes that bloat
    #               every downstream node_modules even though no
    #               runtime code points at them.
    eager_files=$(mktemp)
    reachable_files=$(mktemp)
    queue=$(mktemp)

    # Seed eager from index.html directly. We grep tag-by-tag so we
    # only pick up actual asset hrefs, not arbitrary strings inside
    # any inlined data attributes.
    html="$scen_dir/src/scenarios/$scenario/index.html"
    grep -oE '(href|src)="(/?)assets/[A-Za-z0-9._-]+\.(js|css)"' "$html" \
        | grep -oE 'assets/[A-Za-z0-9._-]+\.(js|css)' \
        | sort -u > "$eager_files" || true

    # Reachable = eager ∪ transitively-followed JS/CSS refs.
    cp "$eager_files" "$queue"
    while [[ -s "$queue" ]]; do
        file=$(head -n1 "$queue")
        sed -i 1d "$queue"
        grep -qxF "$file" "$reachable_files" 2>/dev/null && continue
        echo "$file" >> "$reachable_files"
        full="$scen_dir/$file"
        if [[ -f "$full" ]]; then
            case "$file" in
                *.js|*.css)
                    grep -oE 'assets/[A-Za-z0-9._-]+\.(js|css)' "$full" 2>/dev/null \
                        | sort -u >> "$queue" || true
                    ;;
            esac
        fi
    done

    bucket_sum() {
        local list=$1; local prefix=$2
        local js_raw=0 css_raw=0 js_gz=0 css_gz=0 c_js=0 c_css=0
        while IFS= read -r file; do
            [[ -n "$file" ]] || continue
            local full="$scen_dir/$file"
            [[ -f "$full" ]] || continue
            local size gz
            size=$(stat -c%s "$full")
            gz=$(gzip -c -9 < "$full" | wc -c)
            case "$file" in
                *.js)  js_raw=$((js_raw + size));  js_gz=$((js_gz + gz));  c_js=$((c_js + 1)) ;;
                *.css) css_raw=$((css_raw + size)); css_gz=$((css_gz + gz)); c_css=$((c_css + 1)) ;;
            esac
        done < "$list"
        eval "${prefix}_js_raw=$js_raw"
        eval "${prefix}_js_gz=$js_gz"
        eval "${prefix}_css_raw=$css_raw"
        eval "${prefix}_css_gz=$css_gz"
        eval "${prefix}_c_js=$c_js"
        eval "${prefix}_c_css=$c_css"
    }
    bucket_sum "$eager_files" eager
    bucket_sum "$reachable_files" reach

    total_raw=0; total_gz=0
    while IFS= read -r -d '' f; do
        size=$(stat -c%s "$f")
        gz=$(gzip -c -9 < "$f" | wc -c)
        total_raw=$((total_raw + size))
        total_gz=$((total_gz + gz))
    done < <(find "$scen_dir" -type f \( -name '*.js' -o -name '*.css' \) -print0)

    rm -f "$queue" "$eager_files" "$reachable_files"

    if [[ $first -eq 0 ]]; then
        printf ',' >> "$OUT/sizes.json"
    fi
    first=0
    cat >> "$OUT/sizes.json" <<JSON

    "$scenario": {
      "eager": {
        "js": { "raw": $eager_js_raw, "gzip": $eager_js_gz, "chunks": $eager_c_js },
        "css": { "raw": $eager_css_raw, "gzip": $eager_css_gz, "chunks": $eager_c_css }
      },
      "reachable": {
        "js": { "raw": $reach_js_raw, "gzip": $reach_js_gz, "chunks": $reach_c_js },
        "css": { "raw": $reach_css_raw, "gzip": $reach_css_gz, "chunks": $reach_c_css }
      },
      "total": { "raw": $total_raw, "gzip": $total_gz }
    }
JSON
done
printf '\n  }\n}\n' >> "$OUT/sizes.json"

echo "treeshake: wrote $OUT/sizes.json" >&2
cat "$OUT/sizes.json" >&2
