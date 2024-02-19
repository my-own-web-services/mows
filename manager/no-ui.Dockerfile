# 0. BUILD STAGE
FROM clux/muslrust:stable AS build
# build deps
USER root
RUN apt-get update && apt-get install upx -y
RUN cargo install cargo-build-deps

COPY ./Cargo.toml ./Cargo.lock ./

RUN RUSTFLAGS="--cfg tokio_unstable" cargo build-deps
RUN rm -f target/x86_64-unknown-linux-musl/debug/deps/mows-manager*
# build
COPY --chown=root:root ./src src
RUN RUSTFLAGS="--cfg tokio_unstable" cargo build --bin main
RUN strip target/x86_64-unknown-linux-musl/debug/main
RUN upx --best --lzma target/x86_64-unknown-linux-musl/debug/main



# 1. RUNTIME STAGE
FROM debian:bookworm-slim AS runtime

ARG DEBCONF_NOWARNINGS "yes"
ARG DEBIAN_FRONTEND "noninteractive"
ARG DEBCONF_NONINTERACTIVE_SEEN "true"

RUN apt-get update -y
RUN apt install --no-install-recommends libvirt-clients virtinst dnsmasq wget openssh-client net-tools sshpass iproute2 apt-transport-https gnupg curl ca-certificates -y

# install pixiecore
RUN curl -L https://packagecloud.io/danderson/pixiecore/gpgkey | apt-key add -
RUN echo "deb https://packagecloud.io/danderson/pixiecore/debian stretch main" >/etc/apt/sources.list.d/pixiecore.list
RUN apt-get update -y
RUN apt-get install pixiecore -y

# install helm
RUN curl https://baltocdn.com/helm/signing.asc | gpg --dearmor | tee /usr/share/keyrings/helm.gpg > /dev/null
RUN apt-get install apt-transport-https --yes
RUN echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/helm.gpg] https://baltocdn.com/helm/stable/debian/ all main" | tee /etc/apt/sources.list.d/helm-stable-debian.list
RUN apt-get update
RUN apt-get install helm



WORKDIR /app

COPY --from=build --chown=mows-manager:mows-manager /volume/target/x86_64-unknown-linux-musl/debug/main ./mows-manager
RUN useradd -u 50001 -N mows-manager
RUN groupadd -g 50001 mows-manager

USER root
STOPSIGNAL SIGKILL 
# run it 
ENTRYPOINT ["./mows-manager"]