# 0. BUILD STAGE
FROM ekidd/rust-musl-builder AS build
# build deps
USER root
RUN apt-get update && apt-get install upx -y
RUN cargo install cargo-build-deps

COPY Cargo.toml Cargo.lock ./
RUN cargo build-deps --release
RUN rm -f target/x86_64-unknown-linux-musl/release/deps/filez-addon-metadata*
# build
COPY --chown=root:root src src
RUN cargo build --release --bin main
RUN strip target/x86_64-unknown-linux-musl/release/main
RUN upx --best --lzma target/x86_64-unknown-linux-musl/release/main
RUN useradd -u 50001 -N filez-addon-metadata

# 1. APP STAGE
FROM alpine
RUN apk update && apk add --no-cache perl
WORKDIR /app
RUN wget https://exiftool.org/Image-ExifTool-12.55.tar.gz
RUN tar -xvf Image-ExifTool-12.55.tar.gz
RUN rm Image-ExifTool-12.55.tar.gz
COPY --from=build /home/rust/src/target/x86_64-unknown-linux-musl/release/main ./filez-addon-metadata
COPY --from=build /etc/passwd /etc/passwd

USER filez-addon-metadata
STOPSIGNAL SIGKILL
# run it 
ENTRYPOINT ["./filez-addon-metadata"]
