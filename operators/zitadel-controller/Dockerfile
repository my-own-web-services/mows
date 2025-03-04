
FROM clux/muslrust:stable AS builder
# build deps
USER root
WORKDIR /app
RUN apt-get update && apt-get install upx -y

RUN cargo install cargo-build-deps
COPY Cargo.toml Cargo.lock ./
COPY --from=mows-common . mows-common
COPY ./zitadel-rust ./zitadel-rust

RUN cargo build-deps
RUN rm -f target/x86_64-unknown-linux-musl/release/deps/controller
# build
COPY --chown=root:root src src
RUN cargo build --bin main
#RUN cargo build --bin test_client
#RUN upx --best --lzma target/x86_64-unknown-linux-musl/debug/main
RUN useradd -u 50003 -N controller


# 1. APP STAGE there are connection problems with from scratch
FROM alpine
WORKDIR /app
COPY --from=builder /app/target/x86_64-unknown-linux-musl/debug/main ./controller
#COPY --from=builder /app/target/x86_64-unknown-linux-musl/debug/test_client ./test_client
COPY --from=builder /etc/passwd /etc/passwd
USER controller
ENV SERVICE_NAME=zitadel-controller
ENV SERVICE_VERSION=0.1.0
STOPSIGNAL SIGTERM
# run it 
ENTRYPOINT ["./controller"]

