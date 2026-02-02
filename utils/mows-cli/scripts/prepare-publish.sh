#!/usr/bin/env bash
# Prepare mozart crate for publishing to crates.io by inlining mows-common-rust dependencies
set -e

# Portable sed -i (works on both macOS and Linux)
sedi() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "$@"
    else
        sed -i "$@"
    fi
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOZART_DIR="$(dirname "$SCRIPT_DIR")"
COMMON_DIR="$(dirname "$MOZART_DIR")/mows-common-rust"

echo "Inlining dependencies from mows-common-rust..."

# Copy templating module
mkdir -p "$MOZART_DIR/src/templating"
cp -r "$COMMON_DIR/src/templating/functions" "$MOZART_DIR/src/templating/"
cp "$COMMON_DIR/src/templating/mod.rs" "$MOZART_DIR/src/templating/"

# Copy labels module
cp "$COMMON_DIR/src/labels.rs" "$MOZART_DIR/src/"

# Update main.rs imports - use library name for binary imports
sedi 's/mows_common_rust::/mozart::/g' "$MOZART_DIR/src/main.rs"

# Create lib.rs to expose the modules
cat > "$MOZART_DIR/src/lib.rs" << 'EOF'
pub mod labels;
pub mod templating;
EOF

# Update Cargo.toml
# 1. Replace workspace edition with actual value
sedi 's/edition = { workspace = true }/edition = "2021"/' "$MOZART_DIR/Cargo.toml"

# 2. Replace workspace dependencies with actual versions
sedi 's/serde = { workspace = true, features = \["derive"\] }/serde = { version = "1.0", features = ["derive"] }/' "$MOZART_DIR/Cargo.toml"
sedi 's/serde_json = { workspace = true, features = \["default"\] }/serde_json = "1.0"/' "$MOZART_DIR/Cargo.toml"
sedi 's/serde_yaml = { workspace = true }/serde_yaml = "0.9"/' "$MOZART_DIR/Cargo.toml"
sedi 's/gtmpl = { workspace = true }/gtmpl = "0.7"/' "$MOZART_DIR/Cargo.toml"

# 3. Replace mows-common-rust dependency with inlined dependencies
sedi 's/mows-common-rust = { workspace = true }/# Inlined from mows-common-rust\nthiserror = "2.0"\nanyhow = "1.0"\ngtmpl_value = "0.5"\ngtmpl_derive = "0.5"\nbcrypt = "0.15"\nmd5 = "0.7"\nsha2 = "0.10"\nsha1 = "0.10"\ndata-encoding = "2.9"\nrand = "0.9"\nregex = "1.10"\npath-clean = "1.0"\nrcgen = { version = "0.13", features = ["pem", "x509-parser"] }\ntime = "0.3"\npem = "3.0"\nuuid = { version = "1.17", features = ["v4"] }/' "$MOZART_DIR/Cargo.toml"

# 4. Add package metadata after version line
sedi '/^version = /a description = "Docker Compose label utilities and template rendering"\nlicense = "MIT"\nrepository = "https://github.com/my-own-web-services/mows"\nkeywords = ["docker", "compose", "templates", "labels"]\ncategories = ["command-line-utilities", "template-engine"]' "$MOZART_DIR/Cargo.toml"

# 5. Add bin and lib sections after package section
sedi '/^\[dependencies\]/i [[bin]]\nname = "mozart"\npath = "src/main.rs"\n\n[lib]\nname = "mozart"\npath = "src/lib.rs"\n' "$MOZART_DIR/Cargo.toml"

VERSION=$(grep '^version' "$MOZART_DIR/Cargo.toml" | head -1 | sed 's/.*"\(.*\)".*/\1/')
echo "Done! Mozart v$VERSION is ready for publishing."
