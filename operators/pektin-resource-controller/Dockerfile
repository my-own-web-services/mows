ARG PROFILE="release"
ARG SERVICE_NAME="pektin-resource-controller"
ARG SERVICE_VERSION="0.1.0"
ARG BINARY_NAME="controller"
ARG APP_STAGE_IMAGE="scratch"

FROM scratch AS sources
COPY --from=mows-common-rust . mows-common-rust
COPY --from=pektin-common . pektin-common
COPY --from=lock ./Cargo.lock ./
COPY cargo-workspace-docker.toml ./Cargo.toml

FROM clux/muslrust:nightly AS chef-builder

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
USER root
WORKDIR /build
RUN apt-get update && apt-get install upx -y
COPY --from=sources / /build/

# build deps
WORKDIR /build/app/
COPY --from=planner /build/app/recipe.json recipe.json
RUN  if [ "${PROFILE}" = "release" ];  then cargo chef cook --release --recipe-path recipe.json ;  else cargo chef cook --recipe-path recipe.json ; fi || true

# build
COPY --from=sources / /build/
COPY src src

RUN cargo build --bin ${BINARY_NAME} --profile=${PROFILE}
RUN if [ "${PROFILE}" = "dev" ]; then mv /build/target/x86_64-unknown-linux-musl/debug/${BINARY_NAME} /${BINARY_NAME}; else mv /build/target/x86_64-unknown-linux-musl/${PROFILE}/${BINARY_NAME} /${BINARY_NAME}; fi 
RUN if [ "${PROFILE}" = "release" ];  then strip /${BINARY_NAME}; fi
RUN if [ "${PROFILE}" = "release" ];  then upx --best --lzma /${BINARY_NAME}; fi

RUN useradd -u 50003 -N ${SERVICE_NAME}


# 1. APP STAGE 
FROM ${APP_STAGE_IMAGE}
ARG SERVICE_NAME
ARG SERVICE_VERSION
ARG BINARY_NAME
WORKDIR /app
COPY --from=builder /${BINARY_NAME} ./controller
COPY --from=builder /etc/passwd /etc/passwd
USER ${SERVICE_NAME}
ENV SERVICE_NAME=${SERVICE_NAME}
ENV SERVICE_VERSION=${SERVICE_VERSION}
STOPSIGNAL SIGTERM
# run it 
ENTRYPOINT ["./controller"]

