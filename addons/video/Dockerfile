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
  libvorbis-dev \
  libxcb1-dev \
  libxcb-shm0-dev \
  libxcb-xfixes0-dev \
  pkg-config \
  texinfo \
  wget \
  zlib1g-dev \
  yasm \
  nasm
WORKDIR /app/
RUN git clone https://github.com/OpenVisualCloud/SVT-VP9.git --depth 1

RUN cd SVT-VP9/Build && cmake .. -DCMAKE_BUILD_TYPE=Release &&make -j $(nproc) && make install

RUN git clone https://github.com/FFmpeg/FFmpeg.git ffmpeg --depth 1

RUN cd ffmpeg && git apply ../SVT-VP9/ffmpeg_plugin/master-0001-Add-ability-for-ffmpeg-to-run-svt-vp9.patch && ./configure --enable-libsvtvp9 && make -j $(nproc)


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


# 1. APP STAGE
FROM alpine

WORKDIR /app

COPY --from=build /volume/target/x86_64-unknown-linux-musl/release/main ./filez-addons-video
COPY --from=build /etc/passwd /etc/passwd
COPY --from=ffmpeg-builder /app/ffmpeg/ffmpeg ./ffmpeg


USER filez-addons-video
STOPSIGNAL SIGKILL
# run it 
ENTRYPOINT ["./filez-addons-video"]
