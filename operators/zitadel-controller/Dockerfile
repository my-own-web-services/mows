ARG PROFILE="release"
ARG SERVICE_NAME="zitadel-controller"
ARG SERVICE_VERSION="0.1.0"


FROM scratch AS sources
COPY --from=mows-common . mows-common
COPY --from=zitadel-rust . zitadel-rust
COPY --from=lock ./Cargo.lock ./
COPY dockerbuild.toml ./Cargo.toml



FROM clux/muslrust:stable AS planner
RUN cargo install --git https://github.com/firstdorsal/cargo-chef --rev=56fc03f
COPY --from=sources / /build/
COPY ./ /build/app/
WORKDIR /build/app/ 
RUN ls src
RUN cargo chef prepare --recipe-path recipe.json




FROM clux/muslrust:stable AS builder
ARG PROFILE

USER root
WORKDIR /build
RUN apt-get update && apt-get install upx -y
RUN cargo install cargo-chef --locked

COPY --from=sources / /build/

# build deps
WORKDIR /build/app/
COPY --from=planner /build/app/recipe.json recipe.json
RUN  if [ "${PROFILE}" = "release" ];  then cargo chef cook --release --recipe-path recipe.json ;  else cargo chef cook --recipe-path recipe.json --workspace ; fi || true


# build
COPY src .
RUN cargo build --bin main --profile=${PROFILE}
RUN if [ "${PROFILE}" = "dev" ]; then mv /build/target/x86_64-unknown-linux-musl/debug/main /main; else mv /build/target/x86_64-unknown-linux-musl/${PROFILE}/main /main; fi 
RUN if [ "${PROFILE}" = "release" ];  then strip /main; fi
RUN if [ "${PROFILE}" = "release" ];  then upx --best --lzma /main; fi


RUN useradd -u 50003 -N controller


# 1. APP STAGE there are connection problems with from scratch
FROM alpine
ARG SERVICE_NAME
ARG SERVICE_VERSION
WORKDIR /app
COPY --from=builder /main ./controller
#COPY --from=builder /app/target/x86_64-unknown-linux-musl/debug/test_client ./test_client
COPY --from=builder /etc/passwd /etc/passwd
USER controller
ENV SERVICE_NAME=${SERVICE_NAME}
ENV SERVICE_VERSION=${SERVICE_VERSION}
STOPSIGNAL SIGTERM
# run it 
ENTRYPOINT ["./controller"]

