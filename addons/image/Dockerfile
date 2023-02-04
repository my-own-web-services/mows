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
RUN mkdir -p /home/filez-addons-image/.config/darktable && mkdir -p /home/filez-addons-image/.cache/darktable && chown -R filez-addons-image:filez-addons-image /home/filez-addons-image
RUN mkdir /output/ && chown -R filez-addons-image:filez-addons-image /output/

#RUN mkdir /readonly/{0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99} && chown -R filez-addons-image:filez-addons-image /readonly/
# TODO dont run as root same goes for the other addons the problems are the readonly mounts
USER root
STOPSIGNAL SIGKILL
# run it 
ENTRYPOINT ["./filez-addons-image"]
