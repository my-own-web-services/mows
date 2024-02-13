# 0. BUILD STAGE
FROM clux/muslrust:stable AS build
# build deps
USER root
RUN apt-get update && apt-get install upx -y
RUN cargo install cargo-build-deps

COPY ./Cargo.toml ./Cargo.lock ./

RUN cargo build-deps --release
RUN rm -f target/x86_64-unknown-linux-musl/release/deps/mows-manager*
# build
COPY --chown=root:root ./src src
RUN cargo build --release --bin main
RUN strip target/x86_64-unknown-linux-musl/release/main
RUN upx --best --lzma target/x86_64-unknown-linux-musl/release/main


# 0. build stage
FROM node as ui-build
WORKDIR /app
COPY ui/package.json ui/yarn.lock ./
RUN yarn
COPY ui/ .
RUN yarn build


# 1. RUNTIME STAGE
FROM debian:bookworm-slim AS runtime

ARG DEBCONF_NOWARNINGS "yes"
ARG DEBIAN_FRONTEND "noninteractive"
ARG DEBCONF_NONINTERACTIVE_SEEN "true"

RUN apt-get update -y
RUN apt install --no-install-recommends libvirt-clients virtinst expect wget openssh-client sshpass net-tools iproute2 apt-transport-https gnupg curl ca-certificates -y
RUN curl -L https://packagecloud.io/danderson/pixiecore/gpgkey | apt-key add -
RUN echo "deb https://packagecloud.io/danderson/pixiecore/debian stretch main" >/etc/apt/sources.list.d/pixiecore.list
RUN apt-get update -y
RUN apt-get install pixiecore -y


WORKDIR /app

COPY --from=build --chown=mows-manager:mows-manager /volume/target/x86_64-unknown-linux-musl/release/main ./mows-manager
COPY --from=ui-build /app/dist/ ./ui
RUN useradd -u 50001 -N mows-manager
RUN groupadd -g 50001 mows-manager
COPY ./ssh.exp /ssh.exp



USER root
STOPSIGNAL SIGKILL
EXPOSE 80
# run it 
ENTRYPOINT ["./mows-manager"]