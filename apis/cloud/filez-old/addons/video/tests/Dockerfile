FROM buildpack-deps:focal as BUILDER

WORKDIR /av1

RUN apt-get update && apt-get install -y \
    cmake \
    yasm \
    && rm -rf /var/lib/apt/lists/*

ENV LDFLAGS "-static -static-libgcc"

RUN git clone --depth 1 https://gitlab.com/AOMediaCodec/SVT-AV1.git && \
    cd ./SVT-AV1/Build/ && cmake .. -G"Unix Makefiles" -DCMAKE_BUILD_TYPE=Release && make -j $(nproc)

USER root
RUN sudo make install

RUN