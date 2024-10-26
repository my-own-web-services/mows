# 0. BUILD STAGE
FROM ekidd/rust-musl-builder:nightly-2021-12-23 AS build
# build deps
USER root
RUN cargo install cargo-build-deps
COPY Cargo.toml Cargo.lock ./
RUN cargo build-deps --release
RUN rm -f target/x86_64-unknown-linux-musl/release/deps/feoco*
# build
COPY --chown=root:root src src
RUN cargo build --bin main
RUN strip target/x86_64-unknown-linux-musl/debug/main
RUN useradd -u 50001 -N feoco

# 1. APP STAGE
FROM scratch
WORKDIR /app
COPY --from=build /home/rust/src/target/x86_64-unknown-linux-musl/debug/main ./feoco
COPY --from=build /etc/passwd /etc/passwd
COPY devConfig.yml /config.yml
USER feoco
STOPSIGNAL SIGKILL

# run it 
ENTRYPOINT ["./feoco"]
