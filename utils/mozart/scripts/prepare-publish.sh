#!/usr/bin/env bash
# Prepare mozart crate for publishing to crates.io by inlining mows-common-rust dependencies
set -e

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
sed -i 's/mows_common_rust::/mozart::/g' "$MOZART_DIR/src/main.rs"

# Create lib.rs to expose the modules
cat > "$MOZART_DIR/src/lib.rs" << 'EOF'
pub mod labels;
pub mod templating;
EOF

# Update Cargo.toml - remove mows-common-rust, add required dependencies
cat > "$MOZART_DIR/Cargo.toml" << 'EOF'
[package]
name = "mozart"
version = "0.1.0"
edition = "2021"
description = "Docker Compose label utilities and template rendering"
license = "MIT"
repository = "https://github.com/my-own-web-services/mows"
keywords = ["docker", "compose", "templates", "labels"]
categories = ["command-line-utilities", "template-engine"]

[[bin]]
name = "mozart"
path = "src/main.rs"

[lib]
name = "mozart"
path = "src/lib.rs"

[dependencies]
clap = { version = "4.5", features = ["derive"] }

thiserror = "2.0"
anyhow = "1.0"

serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
serde_yaml = "0.9"

gtmpl = "0.7"
gtmpl_value = "0.5"
gtmpl_derive = "0.5"

jaq-core = "1.5"
jaq-std = "1.6"
jaq-parse = "1.0"
jaq-interpret = "1.5"

# For crypto functions
bcrypt = "0.15"
md5 = "0.7"
sha2 = "0.10"
sha1 = "0.10"
data-encoding = "2.9"

# For random string generation
rand = "0.9"

# For regex functions
regex = "1.10"

# For path functions
path-clean = "1.0"

# For certificate generation
rcgen = { version = "0.13", features = ["pem", "x509-parser"] }
time = "0.3"
pem = "3.0"

# For UUID generation
uuid = { version = "1.17", features = ["v4"] }

[dev-dependencies]
tempfile = "3.8"
EOF

echo "Done! Mozart is ready for publishing."
