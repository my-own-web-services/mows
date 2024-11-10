
FROM clux/muslrust:stable AS builder
# build deps
USER root
WORKDIR /app
RUN apt-get update && apt-get install upx -y

RUN cargo install cargo-build-deps
COPY Cargo.toml Cargo.lock ./
COPY ./pektin-common-temp /pektin-common
COPY ./mows-common-temp /mows-common

# replace ../../apis/core/pektin/common in cargo.toml with /pektin-common
RUN sed -i 's/\.\.\/\.\.\/apis\/core\/pektin\/common/\/pektin-common/g' Cargo.toml
RUN sed -i 's/\.\.\/\.\.\/utils\/mows-common/\/mows-common/g' Cargo.toml


RUN cargo build-deps --release
RUN rm -f target/x86_64-unknown-linux-musl/release/deps/pektin-dns*
# build
COPY --chown=root:root src src
RUN cargo build  --release --bin main
RUN strip target/x86_64-unknown-linux-musl/release/main
RUN upx --best --lzma target/x86_64-unknown-linux-musl/release/main
RUN useradd -u 50003 -N controller


# 1. APP STAGE
FROM scratch
WORKDIR /app
COPY --from=builder /app/target/x86_64-unknown-linux-musl/release/main ./controller
COPY --from=builder /etc/passwd /etc/passwd
USER controller
ENV SERVICE_NAME=pektin-dns-controller
ENV SERVICE_VERSION=0.1.0
STOPSIGNAL SIGTERM
# run it 
ENTRYPOINT ["./controller"]
