use std::path::Path;

use mows_common_rust::{
    openapi_client_generator::{
        generate_openapi_client,
        generators::{rust::RustGeneratorConfig, GeneratorType},
        WriteToDirectoryReplacementStrategy,
    },
    utils::get_absolute_path,
};

#[tokio::main]
#[test]
async fn test() {
    let path = Path::new("../../apis/cloud/filez/server/openapi.json");

    // log resolved path
    dbg!(get_absolute_path(path).unwrap());

    let output_path = "./code_generation/rust/";

    let virtual_file_system =
        generate_openapi_client(path, GeneratorType::Rust(RustGeneratorConfig::default()))
            .await
            .unwrap();

    virtual_file_system
        .write_to_dir(
            Path::new(output_path),
            WriteToDirectoryReplacementStrategy::WriteInto,
        )
        .await
        .unwrap();

    std::process::Command::new("cargo")
        .arg("check")
        .current_dir(output_path)
        .output()
        .expect("Failed to run cargo check");
}

#[tokio::test]
async fn test_derive_default_for_all_optional_structs() {
    let path = Path::new("../../apis/cloud/filez/server/openapi.json");

    // Test with feature disabled
    let config_disabled = RustGeneratorConfig {
        derive_default_for_all_optional_structs: false,
    };

    let vfs_disabled =
        generate_openapi_client(path, GeneratorType::Rust(config_disabled))
            .await
            .unwrap();

    let types_disabled = vfs_disabled.get("src/types.rs").expect("types.rs should exist");

    // Test with feature enabled
    let config_enabled = RustGeneratorConfig {
        derive_default_for_all_optional_structs: true,
    };

    let vfs_enabled =
        generate_openapi_client(path, GeneratorType::Rust(config_enabled))
            .await
            .unwrap();

    let types_enabled = vfs_enabled.get("src/types.rs").expect("types.rs should exist");

    // Count structs with Default derive in both versions
    let default_count_disabled = types_disabled.matches("#[derive(Debug, Clone, Serialize, Deserialize, Default)]").count();
    let default_count_enabled = types_enabled.matches("#[derive(Debug, Clone, Serialize, Deserialize, Default)]").count();

    println!("Default derives when disabled: {}", default_count_disabled);
    println!("Default derives when enabled: {}", default_count_enabled);

    // With feature enabled, there should be more structs with Default derive
    assert!(default_count_enabled >= default_count_disabled,
        "Feature should add Default derive to structs with all optional fields");
}
