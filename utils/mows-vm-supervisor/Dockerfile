ARG PROFILE="release"
ARG SERVICE_NAME="mows-vm-supervisor"
ARG SERVICE_VERSION="0.1.0"
ARG BINARY_NAME="mows-vm-supervisor"
ARG APP_STAGE_IMAGE="alpine"

FROM scratch AS sources
COPY --from=lock ./Cargo.lock ./
COPY cargo-workspace-docker.toml ./Cargo.toml

FROM clux/muslrust:nightly AS chef-builder
ARG CARGO_CHEF_REF
RUN cargo install --git https://github.com/firstdorsal/cargo-chef --rev=08314d0
RUN cargo install --locked --no-default-features sccache
ENV RUSTC_WRAPPER=sccache SCCACHE_DIR=/sccache

FROM chef-builder AS planner
COPY --from=sources / /build/
COPY ./ /build/app/
WORKDIR /build/app/
RUN cargo chef prepare --recipe-path recipe.json

FROM chef-builder AS builder
ARG PROFILE
ARG BINARY_NAME
ARG SERVICE_NAME
USER root
WORKDIR /build
RUN apt-get update && apt-get install -y upx
COPY --from=sources / /build/

WORKDIR /build/app/
COPY --from=planner /build/app/recipe.json recipe.json
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=$SCCACHE_DIR,sharing=locked \
    cargo chef cook --recipe-path recipe.json

COPY --from=sources / /build/
COPY src src
COPY migrations migrations
# Pre-built web UI; build.sh runs `pnpm build` in web/ before invoking
# docker bake. include_dir!() in src/api/web.rs requires this path to exist.
COPY web/dist web/dist

RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=$SCCACHE_DIR,sharing=locked \
    cargo build --bin ${BINARY_NAME} --profile=${PROFILE}

RUN if [ "${PROFILE}" = "dev" ]; then mv /build/target/x86_64-unknown-linux-musl/debug/${BINARY_NAME} /${BINARY_NAME}; else mv /build/target/x86_64-unknown-linux-musl/${PROFILE}/${BINARY_NAME} /${BINARY_NAME}; fi
RUN if [ "${PROFILE}" = "release" ]; then strip /${BINARY_NAME}; fi
RUN if [ "${PROFILE}" = "release" ]; then upx --best --lzma /${BINARY_NAME}; fi

RUN useradd -u 50050 -N ${SERVICE_NAME}

# Final stage. Alpine (not scratch) so the container has qemu-system-x86_64,
# wireguard-tools, and a shell — the supervisor spawns processes, and a
# from-scratch base would force packing all of that into the static binary.
FROM ${APP_STAGE_IMAGE}
ARG SERVICE_NAME
ARG SERVICE_VERSION
ARG BINARY_NAME
WORKDIR /app
RUN apk add --no-cache \
        qemu-system-x86_64 \
        qemu-img \
        openssh-client \
        wireguard-tools \
        iproute2 \
        iptables \
        ca-certificates \
        wget \
        curl
COPY --from=builder /${BINARY_NAME} ./mows-vm-supervisor
COPY --from=builder /etc/passwd /etc/passwd
ENV SERVICE_NAME=${SERVICE_NAME}
ENV SERVICE_VERSION=${SERVICE_VERSION}
ENV MOWS_VM_SUPERVISOR_CONFIG=/etc/mows-vm-supervisor/config.yaml
STOPSIGNAL SIGTERM
ENTRYPOINT ["./mows-vm-supervisor"]
