FROM ffmpeg-static as ffmpeg-static

# 0. BUILD STAGE
FROM clux/muslrust:stable AS build
# build deps
USER root
RUN apt-get update && apt-get install upx -y

COPY --from=ffmpeg-static /ffmpeg /ffmpeg
RUN upx --best --lzma /ffmpeg
COPY --from=ffmpeg-static /ffprobe /ffprobe
RUN upx --best --lzma /ffprobe
RUN chmod +x /ffmpeg /ffprobe

RUN cargo install cargo-build-deps

COPY Cargo.toml Cargo.lock ./
RUN cargo build-deps --release
RUN rm -f target/x86_64-unknown-linux-musl/release/deps/filez-addons-video*
# build
COPY --chown=root:root src src
RUN cargo build --release --bin main
RUN strip target/x86_64-unknown-linux-musl/release/main
RUN upx --best --lzma target/x86_64-unknown-linux-musl/release/main
RUN useradd -u 50001 -N filez-addons-video
RUN groupadd -g 50001 filez-addons-video

RUN mkdir /output && chown filez-addons-video:filez-addons-video /output

# create readonly dirs
RUN mkdir /readonly



# 1. APP STAGE
FROM scratch 
WORKDIR /app

COPY --from=build /ffprobe .
COPY --from=build /ffmpeg .
COPY --from=build /volume/target/x86_64-unknown-linux-musl/release/main ./filez-addons-video
COPY --from=build /etc/passwd /etc/passwd
COPY --from=build /etc/group /etc/group
COPY --from=build /output /output
COPY --from=build --chown=filez-addons-video:filez-addons-video /readonly /readonly


#RUN ./ffmpeg -f lavfi -i testsrc=duration=1:size=1280x720:rate=30 -c:v libsvt_vp9 -rc 1 -b:v 10M -preset 1 -y test.ivf

#USER 
USER filez-addons-video
STOPSIGNAL SIGKILL
# run it 
ENTRYPOINT ["./filez-addons-video"]
