use std::path::Path;

use mows_common_rust::openapi_client_generator::{
    generate_openapi_client,
    generators::{rust::RustGeneratorConfig, GeneratorType},
    WriteToDirectoryReplacementStrategy,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let virtual_file_system = generate_openapi_client(
        Path::new("./openapi.json"),
        GeneratorType::Rust(RustGeneratorConfig::default()),
    )
    .await?;

    virtual_file_system
        .write_to_dir(
            Path::new("../clients/rust/"),
            WriteToDirectoryReplacementStrategy::Replace,
        )
        .await?;

    Ok(())
}
