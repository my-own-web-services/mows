
FROM clux/muslrust:stable AS builder
# build deps
USER root
WORKDIR /app
RUN apt-get update && apt-get install upx -y

RUN cargo install cargo-build-deps
COPY Cargo.toml Cargo.lock ./
COPY ./pektin-common-temp /pektin-common
COPY ./mows-common-temp /mows-common
# replace ../../../../utils/mows-common with /mows-common
RUN sed -i 's/\.\.\/\.\.\/\.\.\/\.\.\/utils\/mows-common/\/mows-common/g' Cargo.toml
# replace ../common with /pektin-common
RUN sed -i 's/\.\.\/common/\/pektin-common/g' Cargo.toml

RUN cargo build-deps --release
RUN rm -f target/x86_64-unknown-linux-musl/release/deps/pektin*
# build
COPY --chown=root:root src src
RUN cargo build  --release --bin main
RUN strip target/x86_64-unknown-linux-musl/release/main
RUN upx --best --lzma target/x86_64-unknown-linux-musl/release/main
RUN useradd -u 50003 -N pektin-api


# 1. APP STAGE
FROM scratch
WORKDIR /app
COPY --from=builder /app/target/x86_64-unknown-linux-musl/release/main ./pektin-api
COPY --from=builder /etc/passwd /etc/passwd
USER pektin-api
ENV SERVICE_NAME=pektin-api
ENV SERVICE_VERSION=0.1.0
STOPSIGNAL SIGTERM
# run it 
ENTRYPOINT ["./pektin-api"]
