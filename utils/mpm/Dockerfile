ARG PROFILE="release"
ARG SERVICE_NAME="mpm"
ARG SERVICE_VERSION="0.2.0"
ARG BINARY_NAME="mpm"
ARG APP_STAGE_IMAGE="scratch"
ARG TARGETARCH="amd64"

FROM scratch AS sources
COPY --from=mows-common-rust . mows-common-rust
COPY --from=lock ./Cargo.lock ./
COPY cargo-workspace-docker.toml ./Cargo.toml

# Using stable version of muslrust for reproducible builds
FROM clux/muslrust:1.92.0-stable AS chef-builder

RUN cargo install --git https://github.com/firstdorsal/cargo-chef --rev=08314d0

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
RUN apt-get update && apt-get install upx -y
COPY --from=sources / /build/

# Determine Rust target based on architecture
# amd64 -> x86_64-unknown-linux-musl, arm64 -> aarch64-unknown-linux-musl
ENV RUST_TARGET_AMD64=x86_64-unknown-linux-musl
ENV RUST_TARGET_ARM64=aarch64-unknown-linux-musl

# build deps
WORKDIR /build/app/
COPY --from=planner /build/app/recipe.json recipe.json
RUN RUST_TARGET=$(if [ "$TARGETARCH" = "arm64" ]; then echo "$RUST_TARGET_ARM64"; else echo "$RUST_TARGET_AMD64"; fi) && \
    if [ "${PROFILE}" = "release" ]; then \
      cargo chef cook --release --recipe-path recipe.json --target=${RUST_TARGET}; \
    else \
      cargo chef cook --recipe-path recipe.json --target=${RUST_TARGET}; \
    fi

# build
COPY --from=sources / /build/
COPY src src

# Disable LTO for arm64 builds (QEMU can't handle it)
RUN RUST_TARGET=$(if [ "$TARGETARCH" = "arm64" ]; then echo "$RUST_TARGET_ARM64"; else echo "$RUST_TARGET_AMD64"; fi) && \
    if [ "$TARGETARCH" = "arm64" ]; then export CARGO_PROFILE_RELEASE_LTO=false; fi && \
    cargo build --bin ${BINARY_NAME} --profile=${PROFILE} --target=${RUST_TARGET}
RUN RUST_TARGET=$(if [ "$TARGETARCH" = "arm64" ]; then echo "$RUST_TARGET_ARM64"; else echo "$RUST_TARGET_AMD64"; fi) && \
    if [ "${PROFILE}" = "dev" ]; then \
      mv /build/target/${RUST_TARGET}/debug/${BINARY_NAME} /${BINARY_NAME}; \
    else \
      mv /build/target/${RUST_TARGET}/${PROFILE}/${BINARY_NAME} /${BINARY_NAME}; \
    fi
RUN if [ "${PROFILE}" = "release" ];  then strip /${BINARY_NAME}; fi
RUN if [ "${PROFILE}" = "release" ];  then upx --best --lzma /${BINARY_NAME}; fi

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
ENTRYPOINT ["./mpm"]
