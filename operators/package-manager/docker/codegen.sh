#!/usr/bin/env bash

set -euo pipefail

/usr/local/bin/docker-entrypoint.sh generate \
    -i /app/swagger.json \
    -g rust \
    -o /local/out/rust \
    --skip-validate-spec \
    --package-name mows-package-manager-client-rust

# replace features = ["json", "multipart"] with features = ["json", "multipart", "rustls-tls"], default-features = false in /local/out/rust/Cargo.toml
sed -i 's/features = \["json", "multipart"\]/features = \["json", "multipart", "rustls-tls"\], default-features = false/g' /local/out/rust/Cargo.toml


# /usr/local/bin/docker-entrypoint.sh generate \
#     -i /app/swagger.json \
#     -g typescript-fetch \
#     --additional-properties=npmName=mows-package-manager-client-typescript \
#     -o /local/out/typescript \
#     --skip-validate-spec \
#     --package-name mows-package-manager-client-typescript
    

chown -R 1000:1000 /local/out

