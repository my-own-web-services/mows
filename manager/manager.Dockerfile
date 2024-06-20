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
#RUN upx --best --lzma target/x86_64-unknown-linux-musl/debug/main



# 1. RUNTIME STAGE
FROM debian:trixie-slim AS runtime

ARG DEBCONF_NOWARNINGS "yes"
ARG DEBIAN_FRONTEND "noninteractive"
ARG DEBCONF_NONINTERACTIVE_SEEN "true"

RUN set -eu && \
    apt-get update && \
    apt-get --no-install-recommends -y install libvirt-clients virtinst expect wget openssh-client sshpass net-tools iproute2 apt-transport-https gnupg curl ca-certificates inetutils-tools && \
    apt-get clean

# install pixiecore
RUN curl -L https://packagecloud.io/danderson/pixiecore/gpgkey | apt-key add -
RUN echo "deb https://packagecloud.io/danderson/pixiecore/debian stretch main" >/etc/apt/sources.list.d/pixiecore.list
RUN apt-get update -y
RUN apt-get install pixiecore -y

# install helm
RUN curl https://baltocdn.com/helm/signing.asc | gpg --dearmor | tee /usr/share/keyrings/helm.gpg > /dev/null
RUN echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/helm.gpg] https://baltocdn.com/helm/stable/debian/ all main" | tee /etc/apt/sources.list.d/helm-stable-debian.list
RUN apt-get update
RUN apt-get install helm

# install kubectl
RUN curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.30/deb/Release.key | gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
RUN chmod 644 /etc/apt/keyrings/kubernetes-apt-keyring.gpg
RUN echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.30/deb/ /' | tee /etc/apt/sources.list.d/kubernetes.list
RUN apt-get update
RUN apt-get install kubectl -y

# colored bash
# https://bash-prompt-generator.org/
RUN echo "PS1='\[\e[38;5;202;1m\]manager\[\e[0m\]:\[\e[1m\]\w\[\e[0;2m\][\$(printf "%d" \$?)]\[\e[0;1m\]> \[\e[0m\]'" >> /root/.bashrc




WORKDIR /app

COPY --from=build --chown=mows-manager:mows-manager /volume/target/x86_64-unknown-linux-musl/debug/main ./mows-manager
RUN useradd -u 50001 -N mows-manager
RUN groupadd -g 50001 mows-manager

USER root
STOPSIGNAL SIGKILL 
# run it 
CMD ["./mows-manager"]