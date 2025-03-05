ARG PROFILE="release"
ARG SERVICE_NAME="zitadel-controller"
ARG SERVICE_VERSION="0.1.0"

FROM clux/muslrust:stable AS builder
# build deps
USER root
WORKDIR /app
RUN apt-get update && apt-get install upx -y

RUN cargo install cargo-build-deps
COPY Cargo.toml Cargo.lock ./
COPY --from=mows-common . mows-common
COPY ./zitadel-rust ./zitadel-rust
ARG PROFILE

RUN if [ "${PROFILE}" = "release" ]; then PROFILE_FOLDER="release"; else echo PROFILE_FOLDER="debug"; fi

RUN echo "PROFILE: ${PROFILE}" && sleep 5

RUN  if [ "${PROFILE}" = "release" ];  then cargo build-deps --release; else cargo build-deps ; fi
RUN  rm -f target/x86_64-unknown-linux-musl/${PROFILE_FOLDER}/deps/controller
# build
COPY --chown=root:root src src
RUN cargo build --bin main --profile=${PROFILE}
#RUN cargo build --bin test_client
RUN if [ "${PROFILE}" = "release" ];  then strip target/x86_64-unknown-linux-musl/${PROFILE_FOLDER}/main; fi
RUN if [ "${PROFILE}" = "release" ];  then upx --best --lzma target/x86_64-unknown-linux-musl/${PROFILE_FOLDER}/main; fi

RUN useradd -u 50003 -N controller


# 1. APP STAGE there are connection problems with from scratch
FROM alpine
ARG PROFILE
ARG SERVICE_NAME
ARG SERVICE_VERSION
WORKDIR /app
COPY --from=builder /app/target/x86_64-unknown-linux-musl/${PROFILE}/main ./controller
#COPY --from=builder /app/target/x86_64-unknown-linux-musl/debug/test_client ./test_client
COPY --from=builder /etc/passwd /etc/passwd
USER controller
ENV SERVICE_NAME=${SERVICE_NAME}
ENV SERVICE_VERSION=${SERVICE_VERSION}
STOPSIGNAL SIGTERM
# run it 
ENTRYPOINT ["./controller"]

