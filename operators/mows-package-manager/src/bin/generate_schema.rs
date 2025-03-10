use mows_package_manager::types::Manifest;
use schemars::schema_for;
fn main() {
    print!("{}", serde_json::to_string(&schema_for!(Manifest)).unwrap())
}
