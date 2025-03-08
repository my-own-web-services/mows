# 0. BUILD STAGE
FROM clux/muslrust:stable AS build
# build deps
USER root
RUN apt-get update && apt-get install upx -y
RUN cargo install cargo-build-deps

COPY ./server/Cargo.toml ./server/Cargo.lock ./
COPY ./common /common

RUN cargo build-deps --release
RUN rm -f target/x86_64-unknown-linux-musl/release/deps/filez-server*
# build
COPY --chown=root:root ./server/src src
RUN cargo build --bin main
#RUN strip target/x86_64-unknown-linux-musl/debug/main
#RUN upx --best --lzma target/x86_64-unknown-linux-musl/debug/main
RUN useradd -u 50001 -N filez-server
RUN groupadd -g 50001 filez-server

# create readonly dirs
RUN mkdir /.dev
RUN chown filez-server:filez-server /.dev

# 1. APP STAGE
FROM ${APP_STAGE_IMAGE}
WORKDIR /app
COPY --from=build /volume/target/x86_64-unknown-linux-musl/debug/main ./filez-server
COPY --from=build /etc/passwd /etc/passwd
COPY --from=build /etc/group /etc/group
COPY --from=build --chown=filez-server:filez-server /.dev /.dev


USER filez-server
STOPSIGNAL SIGKILL
EXPOSE 80
# run it 
ENTRYPOINT ["./filez-server"]
