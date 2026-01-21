ARG PROFILE="release"
ARG SERVICE_NAME="mpm"
ARG SERVICE_VERSION="0.0.0-dev"
ARG BINARY_NAME="mpm"
ARG APP_STAGE_IMAGE="scratch"
ARG TARGETARCH="amd64"

FROM scratch AS sources
COPY --from=mows-common-rust . mows-common-rust
COPY --from=lock ./Cargo.lock ./
COPY cargo-workspace-docker.toml ./Cargo.toml

# Using stable version of muslrust for reproducible builds
FROM --platform=linux/amd64 clux/muslrust:1.92.0-stable AS chef-builder

# Install cargo-chef and cargo-zigbuild for fast cross-compilation
RUN cargo install --git https://github.com/firstdorsal/cargo-chef --rev=08314d0
RUN cargo install cargo-zigbuild
RUN rustup target add aarch64-unknown-linux-musl

# Install zig for cross-compilation (0.15.2 has improved arm64 cross-compilation support)
RUN apt-get update && apt-get install -y xz-utils && rm -rf /var/lib/apt/lists/*
RUN curl -L https://ziglang.org/download/0.15.2/zig-x86_64-linux-0.15.2.tar.xz | tar -xJ -C /usr/local && \
    ln -s /usr/local/zig-x86_64-linux-0.15.2/zig /usr/local/bin/zig

FROM chef-builder AS planner
COPY --from=sources / /build/
COPY ./ /build/app/
WORKDIR /build/app/
RUN cargo chef prepare --recipe-path recipe.json




FROM chef-builder AS builder
ARG PROFILE
ARG RUSTFLAGS
ARG BINARY_NAME
ARG SERVICE_NAME
ARG TARGETARCH
ARG GIT_HASH="unknown"
ARG GIT_DATE="unknown"
ENV GIT_HASH=${GIT_HASH}
ENV GIT_DATE=${GIT_DATE}
USER root
WORKDIR /build
RUN apt-get update && apt-get install -y upx && rm -rf /var/lib/apt/lists/*
COPY --from=sources / /build/

# Determine Rust target based on architecture
# amd64 -> x86_64-unknown-linux-musl, arm64 -> aarch64-unknown-linux-musl
ENV RUST_TARGET_AMD64=x86_64-unknown-linux-musl
ENV RUST_TARGET_ARM64=aarch64-unknown-linux-musl

# build deps
WORKDIR /build/app/
COPY --from=planner /build/app/recipe.json recipe.json
RUN RUST_TARGET=$(if [ "$TARGETARCH" = "arm64" ]; then echo "$RUST_TARGET_ARM64"; else echo "$RUST_TARGET_AMD64"; fi) && \
    ZIGBUILD_FLAG=$(if [ "$TARGETARCH" = "arm64" ]; then echo "--zigbuild"; else echo ""; fi) && \
    if [ "${PROFILE}" = "release" ]; then \
      cargo chef cook --release --recipe-path recipe.json --target=${RUST_TARGET} ${ZIGBUILD_FLAG}; \
    else \
      cargo chef cook --recipe-path recipe.json --target=${RUST_TARGET} ${ZIGBUILD_FLAG}; \
    fi

# build
COPY --from=sources / /build/
COPY Cargo.toml Cargo.toml
COPY build.rs build.rs
COPY src src

# Use cargo-zigbuild for cross-compilation (arm64), regular cargo for native (amd64)
# Use thin LTO for arm64 cross-compilation (full LTO caused SIGILL in older Zig/LLVM)
RUN RUST_TARGET=$(if [ "$TARGETARCH" = "arm64" ]; then echo "$RUST_TARGET_ARM64"; else echo "$RUST_TARGET_AMD64"; fi) && \
    CARGO_CMD=$(if [ "$TARGETARCH" = "arm64" ]; then echo "cargo zigbuild"; else echo "cargo build"; fi) && \
    if [ "$TARGETARCH" = "arm64" ]; then export CARGO_PROFILE_RELEASE_LTO=thin; fi && \
    ${CARGO_CMD} --bin ${BINARY_NAME} --profile=${PROFILE} --target=${RUST_TARGET}
RUN RUST_TARGET=$(if [ "$TARGETARCH" = "arm64" ]; then echo "$RUST_TARGET_ARM64"; else echo "$RUST_TARGET_AMD64"; fi) && \
    if [ "${PROFILE}" = "dev" ]; then \
      mv /build/target/${RUST_TARGET}/debug/${BINARY_NAME} /${BINARY_NAME}; \
    else \
      mv /build/target/${RUST_TARGET}/${PROFILE}/${BINARY_NAME} /${BINARY_NAME}; \
    fi
# Compress with UPX (strip is handled by Rust via profile.release.strip = "symbols")
# Verify compressed binary still works after UPX
RUN if [ "${PROFILE}" = "release" ]; then \
      upx --best --lzma /${BINARY_NAME} && \
      /${BINARY_NAME} --version; \
    fi

# Export binary stage for extraction
FROM scratch AS binary
ARG BINARY_NAME
COPY --from=builder /${BINARY_NAME} /

# App stage (for container usage if needed)
FROM ${APP_STAGE_IMAGE} AS app
ARG SERVICE_NAME
ARG SERVICE_VERSION
ARG BINARY_NAME
WORKDIR /app
COPY --from=builder /${BINARY_NAME} ./mpm
ENV SERVICE_NAME=${SERVICE_NAME}
ENV SERVICE_VERSION=${SERVICE_VERSION}
STOPSIGNAL SIGTERM
# Healthcheck verifies the binary is functional (uses exec form for scratch compatibility)
# Note: On scratch images, exec form runs directly without a shell
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD ["./mpm", "--version"]
ENTRYPOINT ["./mpm"]
