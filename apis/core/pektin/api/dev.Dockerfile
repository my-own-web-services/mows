# 0. BUILD STAGE
FROM ekidd/rust-musl-builder:stable AS build
# only build deps in the first stage for faster builds
USER root
RUN cargo install cargo-build-deps
COPY Cargo.toml Cargo.lock ./
RUN cargo build-deps
RUN rm -f target/x86_64-unknown-linux-musl/debug/deps/pektin*
# build
COPY --chown=rust:rust src src
RUN cargo build --bin main
RUN strip target/x86_64-unknown-linux-musl/debug/main

# 1. APP STAGE
FROM alpine:latest
WORKDIR /app
COPY --from=build /home/rust/src/target/x86_64-unknown-linux-musl/debug/main ./pektin-api
# permissions
RUN addgroup -g 1000 pektin-api
RUN adduser -D -s /bin/sh -u 1000 -G pektin-api pektin-api
RUN chown pektin-api:pektin-api pektin-api
USER pektin-api
# run it 
CMD ./pektin-api
