FROM node:alpine AS ui-builder
WORKDIR /build/
COPY ui/ ./
RUN npm install -g pnpm
RUN pnpm install
RUN pnpm build




FROM clux/muslrust:stable AS builder
# build deps
USER root
WORKDIR /app
RUN apt-get update && apt-get install upx -y

RUN cargo install cargo-build-deps
COPY Cargo.toml Cargo.lock ./
COPY --from=mows-common . mows-common

RUN cargo build-deps --release
RUN rm -f target/x86_64-unknown-linux-musl/release/deps/package-manager*

# build
COPY migrations migrations
COPY --chown=root:root src src
COPY --from=ui-builder /build/dist ./ui-build
RUN cargo build  --release --bin server
RUN upx --best --lzma target/x86_64-unknown-linux-musl/release/server
RUN useradd -u 50003 -N mows-package-manager




# 1. APP STAGE
FROM alpine:latest
RUN apk add --no-cache helm git
WORKDIR /app
COPY --from=builder /app/target/x86_64-unknown-linux-musl/release/server ./mows-package-manager
COPY --from=builder /etc/passwd /etc/passwd
RUN mkdir -p /db/ && chown -R mows-package-manager /db/
USER mows-package-manager
ENV SERVICE_NAME=mows-package-manager
ENV SERVICE_VERSION=0.1.0
STOPSIGNAL SIGTERM
ENTRYPOINT ["./mows-package-manager"]
