use std::{fs, path::Path};

use mows_common_rust::{
    openapi_client_generator::{
        generate_openapi_client,
        generators::{rust::RustGeneratorConfig, GeneratorType},
        WriteToDirectoryReplacementStrategy,
    },
    utils::get_absolute_path,
};
use path_clean::PathClean;

#[tokio::main]
#[test]
async fn test() {
    let path = Path::new("../../apis/cloud/filez/server/openapi.json");

    // log resolved path
    dbg!(get_absolute_path(path).unwrap());

    let virtual_file_system =
        generate_openapi_client(path, GeneratorType::Rust(RustGeneratorConfig::default()))
            .await
            .unwrap();

    virtual_file_system
        .write_to_dir(
            Path::new("./code_generation/rust/"),
            WriteToDirectoryReplacementStrategy::Replace,
        )
        .await
        .unwrap();

    std::process::Command::new("cargo")
        .arg("check")
        .current_dir("./code_generation/rust/")
        .output()
        .expect("Failed to run cargo check");

    fs::remove_dir_all("./code_generation/rust/").unwrap();
}
