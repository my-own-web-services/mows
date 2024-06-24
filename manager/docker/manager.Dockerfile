FROM lukemathwalker/cargo-chef:latest-rust-1 AS chef
WORKDIR /app

FROM chef AS planner
COPY ./Cargo.toml ./Cargo.lock ./
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder 
COPY --from=planner /app/recipe.json recipe.json
# Build dependencies - this is the caching Docker layer!
RUN RUSTFLAGS="--cfg tokio_unstable" cargo chef cook --recipe-path recipe.json
# Build application
COPY . .
RUN RUSTFLAGS="--cfg tokio_unstable" cargo build --bin main


# 1. RUNTIME STAGE
FROM debian:trixie-slim AS runtime

ARG DEBCONF_NOWARNINGS "yes"
ARG DEBIAN_FRONTEND "noninteractive"
ARG DEBCONF_NONINTERACTIVE_SEEN "true"

RUN set -eu && \
    apt-get update && \
    apt-get --no-install-recommends -y install libvirt-clients virtinst expect wget openssh-client sshpass net-tools iproute2 apt-transport-https gnupg curl ca-certificates inetutils-tools inetutils-ping htop dnsutils

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

# download k9s https://github.com/derailed/k9s/releases/download/v0.32.5/k9s_linux_amd64.deb
RUN wget https://github.com/derailed/k9s/releases/download/v0.32.5/k9s_linux_amd64.deb -O /tmp/k9s.deb
RUN dpkg -i /tmp/k9s.deb
RUN mkdir -p /etc/bash_completion.d
RUN k9s completion bash > /etc/bash_completion.d/k9s 

# install kustomize
RUN wget https://github.com/kubernetes-sigs/kustomize/releases/download/kustomize%2Fv5.4.2/kustomize_v5.4.2_linux_amd64.tar.gz -O /tmp/kustomize.tar.gz
RUN tar -xvf /tmp/kustomize.tar.gz -C /usr/local/bin
RUN chmod +x /usr/local/bin/kustomize


# colored bash
# https://bash-prompt-generator.org/
COPY ./misc/.bashrc /root/.bashrc

ENV TERM=xterm

WORKDIR /app

COPY --from=builder --chown=mows-manager:mows-manager /app/target/debug/main ./mows-manager
RUN useradd -u 50001 -N mows-manager
RUN groupadd -g 50001 mows-manager

USER root
STOPSIGNAL SIGKILL 
# run it 
CMD ["./mows-manager"]