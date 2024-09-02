use mows_operator::public_ip::index::handle_public_ip;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    handle_public_ip().await?;

    Ok(())
}
