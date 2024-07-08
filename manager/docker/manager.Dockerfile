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
    apt-get --no-install-recommends -y install libvirt-clients virtinst expect wget openssh-client sshpass net-tools iproute2 apt-transport-https gnupg curl ca-certificates inetutils-tools inetutils-ping htop dnsutils dnsmasq git vim nano less

# install pixiecore
RUN curl -L https://packagecloud.io/danderson/pixiecore/gpgkey | apt-key add - && \
    echo "deb https://packagecloud.io/danderson/pixiecore/debian/ stretch main" > /etc/apt/sources.list.d/pixiecore.list && \
    apt-get update && \
    apt-get install -y pixiecore


# install helm
RUN curl https://baltocdn.com/helm/signing.asc | gpg --dearmor | tee /usr/share/keyrings/helm.gpg > /dev/null && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/helm.gpg] https://baltocdn.com/helm/stable/debian/ all main" | tee /etc/apt/sources.list.d/helm-stable-debian.list && \
    apt-get update && \
    apt-get install -y helm && \
    apt-get clean


# install kubectl
RUN curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.30/deb/Release.key | gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.30/deb/ /" | tee /etc/apt/sources.list.d/kubernetes.list && \
    apt-get update && \
    apt-get install -y kubectl && \
    apt-get clean


# download k9s https://github.com/derailed/k9s/releases/download/v0.32.5/k9s_linux_amd64.deb
RUN wget https://github.com/derailed/k9s/releases/download/v0.32.5/k9s_linux_amd64.deb -O /tmp/k9s.deb && \
    dpkg -i /tmp/k9s.deb && \
    rm /tmp/k9s.deb && \
    mkdir -p /etc/bash_completion.d && \
    k9s completion bash > /etc/bash_completion.d/k9s && \
    apt-get clean



# install cilium cli
RUN wget https://github.com/cilium/cilium-cli/releases/download/v0.16.11/cilium-linux-amd64.tar.gz && \
    tar -xvf cilium-linux-amd64.tar.gz -C /usr/local/bin && \
    chmod +x /usr/local/bin/cilium



# install krew
RUN set -x; cd "$(mktemp -d)" && \
    OS="$(uname | tr '[:upper:]' '[:lower:]')" && \
    ARCH="$(uname -m | sed -e 's/x86_64/amd64/' -e 's/\(arm\)\(64\)\?.*/\1\2/' -e 's/aarch64$/arm64/')" && \
    KREW="krew-${OS}_${ARCH}" && \
    curl -fsSLO "https://github.com/kubernetes-sigs/krew/releases/latest/download/${KREW}.tar.gz" && \
    tar zxvf "${KREW}.tar.gz" && \
    ./"${KREW}" install krew
RUN PATH="${KREW_ROOT:-$HOME/.krew}/bin:$PATH" kubectl krew install cnpg


# colored bash
# https://bash-prompt-generator.org/
COPY ./misc/.bashrc /root/.bashrc


# TODO: this should not be set globally
ENV TERM=xterm

WORKDIR /app

COPY --from=builder --chown=mows-manager:mows-manager /app/target/debug/main ./mows-manager
RUN useradd -u 50001 -N mows-manager
RUN groupadd -g 50001 mows-manager

USER root
STOPSIGNAL SIGKILL 
# run it 
CMD ["./mows-manager"]