# 0. BUILD STAGE
FROM ekidd/rust-musl-builder AS build
# build deps
USER root
RUN apt-get update && apt-get install upx -y
RUN cargo install cargo-build-deps

COPY Cargo.toml Cargo.lock ./
RUN cargo build-deps --release
RUN rm -f target/x86_64-unknown-linux-musl/release/deps/filez-server*
# build
COPY --chown=root:root src src
RUN cargo build --release --bin main
RUN strip target/x86_64-unknown-linux-musl/release/main
RUN upx --best --lzma target/x86_64-unknown-linux-musl/release/main
RUN useradd -u 50001 -N filez-server

# 1. APP STAGE
FROM scratch
WORKDIR /app
COPY --from=build /home/rust/src/target/x86_64-unknown-linux-musl/release/main ./filez-server
COPY --from=build /etc/passwd /etc/passwd
USER filez-server
STOPSIGNAL SIGKILL
EXPOSE 80
# run it 
ENTRYPOINT ["./filez-server"]
