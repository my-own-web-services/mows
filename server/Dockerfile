# 0. BUILD STAGE
FROM ekidd/rust-musl-builder AS build
# build deps
USER root
RUN apt-get update && apt-get install upx -y
RUN cargo install cargo-build-deps

COPY Cargo.toml Cargo.lock ./
RUN cargo build-deps --release
RUN rm -f target/x86_64-unknown-linux-musl/release/deps/feoco*
# build
COPY --chown=root:root src src
RUN cargo build --release --bin main
RUN strip target/x86_64-unknown-linux-musl/release/main
RUN upx --best --lzma target/x86_64-unknown-linux-musl/release/main
RUN useradd -u 50001 -N feoco

# 1. APP STAGE
FROM scratch
WORKDIR /app
COPY --from=build /home/rust/src/target/x86_64-unknown-linux-musl/release/main ./feoco
COPY --from=build /etc/passwd /etc/passwd
COPY config.yml /config.yml
USER feoco
STOPSIGNAL SIGKILL
# run it 
ENTRYPOINT ["./feoco"]
