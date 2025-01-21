FROM node:alpine AS ui-builder
WORKDIR /build/
COPY ui/ ./
RUN npm install -g pnpm
RUN pnpm install
RUN pnpm build




FROM clux/muslrust:stable AS builder
# build deps
USER root
WORKDIR /app
RUN apt-get update && apt-get install upx -y

RUN cargo install cargo-build-deps
COPY Cargo.toml Cargo.lock ./
# replace "../operators/package-manager" with  "mows-package-manager" in Cargo.toml
RUN  sed -i 's/..\/operators\/package-manager/mows-package-manager/g' Cargo.toml
COPY ./mows-package-manager-temp mows-package-manager
RUN sed -i 's/\.\.\/\.\.\/utils\/mows-common/\/mows-common/g' mows-package-manager/Cargo.toml

COPY ./mows-common-temp /mows-common

RUN RUSTFLAGS="--cfg tokio_unstable" cargo build-deps --release

# build
COPY --chown=root:root src src
COPY --from=ui-builder /build/dist ./ui-build
RUN RUSTFLAGS="--cfg tokio_unstable" cargo build --release --bin main
#RUN upx --best --lzma target/x86_64-unknown-linux-musl/release/main




# build pixiecore from go go get go.universe.tf/netboot/cmd/pixiecore
FROM golang:alpine3.21 AS pixiecore-builder
RUN go install go.universe.tf/netboot/cmd/pixiecore@latest




# 1. RUNTIME STAGE
FROM debian:trixie-slim AS runtime

ARG DEBCONF_NOWARNINGS "yes"
ARG DEBIAN_FRONTEND "noninteractive"
ARG DEBCONF_NONINTERACTIVE_SEEN "true"
ARG BASH_COMPLETIONS_DIR="/etc/bash_completion.d/"

RUN set -eu && \
    apt-get update && \
    apt-get --no-install-recommends -y install libvirt-clients virtinst expect wget openssh-client sshpass net-tools iproute2 apt-transport-https gnupg curl ca-certificates inetutils-tools inetutils-ping htop dnsutils dnsmasq git vim nano less jq tcpdump wireguard ustreamer tesseract-ocr systemd bpftool tmux bash-completion


RUN mkdir -p $BASH_COMPLETIONS_DIR

# install pixiecore
COPY --from=pixiecore-builder /go/bin/pixiecore /usr/local/bin/pixiecore


# install helm
RUN curl https://baltocdn.com/helm/signing.asc | gpg --dearmor | tee /usr/share/keyrings/helm.gpg > /dev/null && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/helm.gpg] https://baltocdn.com/helm/stable/debian/ all main" | tee /etc/apt/sources.list.d/helm-stable-debian.list && \
    apt-get update && \
    apt-get install -y helm && \
    apt-get clean


# install kubectl
RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && \
    install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl && \
    kubectl completion bash > $BASH_COMPLETIONS_DIR/kubectl



# install k9s
RUN wget https://github.com/derailed/k9s/releases/download/v0.32.5/k9s_linux_amd64.deb -O /tmp/k9s.deb && \
    dpkg -i /tmp/k9s.deb && \
    rm /tmp/k9s.deb && \
    mkdir -p $BASH_COMPLETIONS_DIR && \
    k9s completion bash > $BASH_COMPLETIONS_DIR/k9s && \
    apt-get clean



# install cilium cli
RUN wget https://github.com/cilium/cilium-cli/releases/download/v0.16.11/cilium-linux-amd64.tar.gz && \
    tar -xvf cilium-linux-amd64.tar.gz -C /usr/local/bin && \
    chmod +x /usr/local/bin/cilium  && \
    cilium completion bash > $BASH_COMPLETIONS_DIR/cilium


# install krew
RUN set -x; cd "$(mktemp -d)" && \
    OS="$(uname | tr '[:upper:]' '[:lower:]')" && \
    ARCH="$(uname -m | sed -e 's/x86_64/amd64/' -e 's/\(arm\)\(64\)\?.*/\1\2/' -e 's/aarch64$/arm64/')" && \
    KREW="krew-${OS}_${ARCH}" && \
    curl -fsSLO "https://github.com/kubernetes-sigs/krew/releases/latest/download/${KREW}.tar.gz" && \
    tar zxvf "${KREW}.tar.gz" && \
    ./"${KREW}" install krew

# install krew plugins
RUN PATH="${KREW_ROOT:-$HOME/.krew}/bin:$PATH" kubectl krew install cnpg gadget cert-manager ctx deprecations df-pv doctor exec-as flame get-all graph ice kubescape kurt kyverno ns outdated popeye pv-mounter pv-migrate rbac-tool rbac-lookup resource-capacity sniff stern tap trace tree view-secret virt



# install helmfile https://github.com/helmfile/helmfile/releases/download/v1.0.0-rc.2/helmfile_1.0.0-rc.2_linux_amd64.tar.gz
#RUN wget https://github.com/helmfile/helmfile/releases/download/v1.0.0-rc.2/helmfile_1.0.0-rc.2_linux_amd64.tar.gz -O /tmp/helmfile.tar.gz && \
#    tar -xvf /tmp/helmfile.tar.gz -C /usr/local/bin && \
#    chmod +x /usr/local/bin/helmfile && \
#    rm /tmp/helmfile.tar.gz


# install helm plugins
RUN helm plugin install https://github.com/databus23/helm-diff && \
    helm plugin install https://github.com/hypnoglow/helm-s3.git && \
    helm plugin install https://github.com/jkroepke/helm-secrets && \
    helm plugin install https://github.com/aslafy-z/helm-git

# install argocd-cli
RUN VERSION=$(curl --silent "https://api.github.com/repos/argoproj/argo-cd/releases/latest" | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/') && \
    curl -sSL -o /usr/local/bin/argocd https://github.com/argoproj/argo-cd/releases/download/$VERSION/argocd-linux-amd64 && \
    chmod +x /usr/local/bin/argocd && \
    argocd completion bash > $BASH_COMPLETIONS_DIR/argocd


# colored bash & other bash stuff
# https://bash-prompt-generator.org/
COPY ./misc/.bashrc /root/.bashrc


ENV TERM=xterm
ENV XDG_CONFIG_HOME=/root/.config

WORKDIR /app

COPY --from=builder --chown=mows-manager:mows-manager /app/target/x86_64-unknown-linux-musl/release/main ./mows-manager
RUN useradd -u 50001 -N mows-manager
RUN groupadd -g 50001 mows-manager

USER root
STOPSIGNAL SIGKILL 
CMD ["./mows-manager"]