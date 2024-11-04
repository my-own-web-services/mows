
FROM clux/muslrust:stable AS builder
# build deps
USER root
WORKDIR /app
RUN apt-get update && apt-get install upx -y

RUN cargo install cargo-build-deps
COPY Cargo.toml Cargo.lock ./
RUN cargo build-deps --release
RUN rm -f target/x86_64-unknown-linux-musl/release/deps/controller*
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
STOPSIGNAL SIGTERM
# run it 
ENTRYPOINT ["./controller"]
