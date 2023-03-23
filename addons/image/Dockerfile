# 0. BUILD STAGE
FROM clux/muslrust:stable AS build
# build deps
USER root
RUN apt-get update && apt-get install upx nasm -y
RUN cargo install cargo-build-deps

COPY Cargo.toml Cargo.lock ./
RUN cargo build-deps --release
RUN rm -f target/x86_64-unknown-linux-musl/release/deps/filez-addons-image*
# build
COPY --chown=root:root src src
RUN cargo build --release --bin main
RUN strip target/x86_64-unknown-linux-musl/release/main
RUN upx --best --lzma target/x86_64-unknown-linux-musl/release/main
RUN useradd -u 50001 -N filez-addons-image
RUN groupadd -g 50001 filez-addons-image

# 1. APP STAGE
FROM alpine
RUN apk update && apk add --no-cache perl darktable musl-locales musl-locales-lang
WORKDIR /app
RUN wget https://exiftool.org/Image-ExifTool-12.55.tar.gz
RUN tar -xvf Image-ExifTool-12.55.tar.gz
RUN rm Image-ExifTool-12.55.tar.gz

COPY --from=build /volume/target/x86_64-unknown-linux-musl/release/main ./filez-addons-image
COPY --from=build /etc/passwd /etc/passwd
COPY --from=build /etc/group /etc/group

# create darktable config
RUN mkdir -p /home/filez-addons-image/.config/darktable && mkdir -p /home/filez-addons-image/.cache/darktable && chown -R filez-addons-image:filez-addons-image /home/filez-addons-image

# create output dir
RUN mkdir /output/ && chown -R filez-addons-image:filez-addons-image /output/

# create readonly input dirs
RUN mkdir /readonly
RUN chown filez-addons-image:filez-addons-image /readonly

USER filez-addons-image
STOPSIGNAL SIGKILL
# run it 
ENTRYPOINT ["./filez-addons-image"]
