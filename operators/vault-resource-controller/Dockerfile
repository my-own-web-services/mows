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
RUN RUSTFLAGS="--cfg tokio_unstable" cargo build --bin controller


FROM debian
COPY --from=builder /app/target/debug/controller /app/controller
CMD ["/app/controller"]
