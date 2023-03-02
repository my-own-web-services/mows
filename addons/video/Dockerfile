# ffmpeg build stage
FROM ubuntu as ffmpeg-builder


RUN apt-get update && DEBIAN_FRONTEND=noninteractive TZ=Etc/UTC apt-get install -y autoconf \
  automake \
  build-essential \
  cmake \
  git-core \
  libass-dev \
  libfreetype6-dev \
  libsdl2-dev \
  libtool \
  libva-dev \
  libvdpau-dev \
  libxcb1-dev \
  libxcb-shm0-dev \
  libxcb-xfixes0-dev \
  pkg-config \
  texinfo \
  wget \
  zlib1g-dev \
  yasm \
  nasm \
    libopus-dev \
    libvorbis-dev \
    libwebp-dev

WORKDIR /app/
RUN git clone https://github.com/OpenVisualCloud/SVT-VP9.git

ARG LD_LIBRARY_PATH=/usr/local/lib

RUN cd SVT-VP9/Build && cmake .. -DCMAKE_BUILD_TYPE=Release && make -j $(nproc) && make install

RUN git clone https://github.com/FFmpeg/FFmpeg.git ffmpeg

RUN cd ffmpeg && git apply ../SVT-VP9/ffmpeg_plugin/master-0001-Add-ability-for-ffmpeg-to-run-svt-vp9.patch && ./configure \
    --enable-libsvtvp9 \
    --enable-libvorbis \ 
    --enable-libopus \ 
    --enable-libwebp \ 
    --enable-libass \
    --enable-gpl \
    --enable-libfreetype \
    && make -j $(nproc)

RUN ./ffmpeg/ffmpeg -f lavfi -i testsrc=duration=1:size=1280x720:rate=30 -c:v libsvt_vp9 -rc 1 -b:v 10M -preset 1 -y test.ivf



# 0. BUILD STAGE
FROM clux/muslrust:stable AS build
# build deps
USER root
RUN apt-get update && apt-get install upx -y
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

# 1. APP STAGE
FROM ubuntu

WORKDIR /app

RUN apt-get update && DEBIAN_FRONTEND=noninteractive TZ=Etc/UTC apt-get install -y ffmpeg libvorbis-dev libopus-dev libwebp-dev

COPY --from=build /volume/target/x86_64-unknown-linux-musl/release/main ./filez-addons-video
COPY --from=build /etc/passwd /etc/passwd
COPY --from=build /etc/group /etc/group
COPY --from=ffmpeg-builder --chown=filez-addons-video:filez-addons-video /app/ffmpeg/ffmpeg ./ffmpeg
COPY --from=ffmpeg-builder --chown=filez-addons-video:filez-addons-video /app/ffmpeg/ffprobe ./ffprobe
COPY --from=ffmpeg-builder --chown=filez-addons-video:filez-addons-video /usr/local/lib/libSvtVp9Enc.so.1 /usr/lib

RUN mkdir /output/ && chown filez-addons-video:filez-addons-video /output
RUN mkdir /readonly/ && chown filez-addons-video:filez-addons-video /readonly

RUN ./ffmpeg -f lavfi -i testsrc=duration=1:size=1280x720:rate=30 -c:v libsvt_vp9 -rc 1 -b:v 10M -preset 1 -y test.ivf

#USER filez-addons-video
USER root
STOPSIGNAL SIGKILL
# run it 
ENTRYPOINT ["./filez-addons-video"]
