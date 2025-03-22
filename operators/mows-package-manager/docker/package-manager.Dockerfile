ARG PROFILE="release"
ARG RUSTFLAGS="--cfg tokio_unstable"
ARG BINARY_NAME="server"

FROM node:23.9.0-alpine3.21@sha256:191433e4778ded9405c9fc981f963ad2062a8648b59a9bc97d7194f3d183b2b2 AS ui-builder
WORKDIR /build/
COPY ui/ ./
RUN npm install -g pnpm
RUN pnpm install
RUN pnpm build


FROM scratch AS sources
COPY --from=mows-common . mows-common
COPY --from=lock ./Cargo.lock ./
COPY dockerbuild.toml ./Cargo.toml

FROM clux/muslrust:stable AS chef-builder

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
COPY --from=ui-builder /build/dist ./ui-build


RUN cargo build --bin ${BINARY_NAME} --profile=${PROFILE}
RUN if [ "${PROFILE}" = "dev" ]; then mv /build/target/x86_64-unknown-linux-musl/debug/${BINARY_NAME} /${BINARY_NAME}; else mv /build/target/x86_64-unknown-linux-musl/${PROFILE}/${BINARY_NAME} /${BINARY_NAME}; fi 
RUN if [ "${PROFILE}" = "release" ];  then strip /${BINARY_NAME}; fi
RUN if [ "${PROFILE}" = "release" ];  then upx --best --lzma /${BINARY_NAME}; fi




# 1. APP STAGE
FROM alpine:latest
ARG BINARY_NAME
RUN apk add --no-cache helm git
WORKDIR /app
COPY --from=builder /${BINARY_NAME} ./server
COPY --from=builder /etc/passwd /etc/passwd
USER mows-package-manager
ENV SERVICE_NAME=mows-package-manager
ENV SERVICE_VERSION=0.1.0
STOPSIGNAL SIGTERM
ENTRYPOINT ["./server"]
