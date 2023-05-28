# 0. BUILD STAGE
FROM clux/muslrust:stable AS build
# build deps
USER root
RUN apt-get update && apt-get install upx -y
RUN cargo install cargo-build-deps

COPY Cargo.toml Cargo.lock ./
RUN cargo build-deps --release
RUN rm -f target/x86_64-unknown-linux-musl/release/deps/filez-addons-metadata*
# build
COPY --chown=root:root src src
RUN cargo build --release --bin main
RUN strip target/x86_64-unknown-linux-musl/release/main
RUN upx --best --lzma target/x86_64-unknown-linux-musl/release/main
RUN useradd -u 50001 -N filez-addons-metadata
RUN groupadd -g 50001 filez-addons-metadata

# 1. APP STAGE
FROM alpine

RUN echo "https://dl-cdn.alpinelinux.org/alpine/edge/main" >> /etc/apk/repositories && \
    echo "https://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories 

RUN apk update && apk add --no-cache perl tesseract-ocr tesseract-ocr-data-eng tesseract-ocr-data-deu
WORKDIR /app
RUN wget https://exiftool.org/Image-ExifTool-12.55.tar.gz
RUN tar -xvf Image-ExifTool-12.55.tar.gz
RUN rm Image-ExifTool-12.55.tar.gz

# copy bin
COPY --from=build /volume/target/x86_64-unknown-linux-musl/release/main ./filez-addons-metadata

# copy users and groups
COPY --from=build /etc/passwd /etc/passwd
COPY --from=build /etc/group /etc/group

# create readonly dirs
RUN mkdir /readonly


RUN chown filez-addons-metadata:filez-addons-metadata /readonly

USER filez-addons-metadata
STOPSIGNAL SIGKILL
# run it 
ENTRYPOINT ["./filez-addons-metadata"]
