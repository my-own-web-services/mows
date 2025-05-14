# 0. BUILD STAGE
FROM clux/muslrust:stable AS build
# build deps
USER root
RUN apt-get update && apt-get install upx -y
RUN cargo install cargo-build-deps

COPY Cargo.toml Cargo.lock ./
RUN cargo build-deps --release
RUN rm -f target/x86_64-unknown-linux-musl/release/deps/filez-addons-muzik*
# build
COPY --chown=root:root src src
RUN cargo build --release --bin main
RUN strip target/x86_64-unknown-linux-musl/release/main
RUN upx --best --lzma target/x86_64-unknown-linux-musl/release/main
RUN useradd -u 50001 -N filez-addons-muzik
RUN groupadd -g 50001 filez-addons-muzik

# 1. APP STAGE
FROM scratch
WORKDIR /app
COPY --from=build /volume/target/x86_64-unknown-linux-musl/release/main ./filez-addons-muzik
COPY --from=build /etc/passwd /etc/passwd
COPY --from=build /etc/group /etc/group

USER filez-addons-muzik
STOPSIGNAL SIGKILL
# run it 
ENTRYPOINT ["./filez-addons-muzik"]
