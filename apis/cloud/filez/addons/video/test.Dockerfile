FROM ubuntu
RUN apt update && apt install -y wget
ARG SVT_VP9_VERSION=0.3.0
ARG SVT_VP9_URL="https://github.com/OpenVisualCloud/SVT-VP9/archive/refs/tags/v$SVT_VP9_VERSION.tar.gz"
ARG SVT_VP9_SHA256=6ee01b81c43816170b18709c6045b6245cecc2953f01cecc9e98f82b49ea4f73
RUN \
    wget $WGET_OPTS -O svt-vp9.tar.gz "$SVT_VP9_URL" && \
    tar xf svt-vp9.tar.gz && \
    cd SVT-VP9-* && \
    mkdir -p build && cd build && \
    cmake -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/usr/local .. && \
    make -j$(nproc) && make install