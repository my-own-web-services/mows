#!/usr/bin/env bash
# Build the @mows/react-components docs SPA for static hosting.
#
# Output goes to `components/react/dist-site/`. The same script runs locally
# and in the publish workflow — CI must not invent its own build steps
# (per repo policy in CLAUDE.md). To preview the result locally:
#
#   bash scripts/build-docs.sh
#   pnpm preview:site
#
# Or for a path-prefixed build matching the deployed site:
#
#   SITE_BASE=/mows-react-components/ bash scripts/build-docs.sh
#
# Environment variables:
#   SITE_BASE   Public path the site will be served from. Must start AND end
#               with a slash. Defaults to `/mows-react-components/`, matching
#               the org Pages layout at https://my-own-web-services.github.io/
#               mows-react-components/. Override to `/` for root-served local
#               previews.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PKG_DIR}"

SITE_BASE="${SITE_BASE:-/mows-react-components/}"
case "${SITE_BASE}" in
    /*/) ;;
    *)
        echo "error: SITE_BASE must start and end with '/' (got: '${SITE_BASE}')" >&2
        exit 1
        ;;
esac

# Pin pnpm via corepack so local + CI use the same version. Falls back to a
# preinstalled pnpm when corepack is unavailable.
if command -v corepack >/dev/null 2>&1; then
    corepack enable >/dev/null 2>&1 || true
fi

# Use frozen lockfile so the artefact is reproducible across machines.
pnpm install --frozen-lockfile

SITE_BASE="${SITE_BASE}" pnpm run build:site

OUT_DIR="${PKG_DIR}/dist-site"

# GitHub Pages serves files under a static-asset Jekyll pipeline by default,
# which strips paths starting with `_`. `.nojekyll` opts out.
touch "${OUT_DIR}/.nojekyll"

# Client-side routes (e.g. `/RadioGroup`) are unknown to the static host.
# Pointing 404.html at the same SPA shell lets the React router pick the
# path up after a hard refresh.
cp "${OUT_DIR}/index.html" "${OUT_DIR}/404.html"

echo
echo "Docs site built at ${OUT_DIR}"
echo "Base path: ${SITE_BASE}"
