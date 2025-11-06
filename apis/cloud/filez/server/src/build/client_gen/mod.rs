use std::path::Path;

use mows_common_rust::openapi_client_generator::{
    generate_openapi_client,
    generators::{rust::RustGeneratorConfig, GeneratorType},
    WriteToDirectoryReplacementStrategy,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut virtual_file_system = generate_openapi_client(
        Path::new("./openapi.json"),
        GeneratorType::Rust(RustGeneratorConfig::default()),
    )
    .await?;

    virtual_file_system.insert(
        "src/utils.rs",
        include_str!("./templates/utils.rs").to_string(),
    );

    let lib_file = virtual_file_system.get("src/lib.rs");

    if let Some(lib_file) = lib_file {
        let new_lib_file = format!("{}\npub mod utils;", lib_file);
        virtual_file_system.insert("src/lib.rs", new_lib_file);
    }

    virtual_file_system
        .write_to_dir(
            Path::new("../clients/rust/"),
            WriteToDirectoryReplacementStrategy::Replace,
        )
        .await?;

    Ok(())
}
