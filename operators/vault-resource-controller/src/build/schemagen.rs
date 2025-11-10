use controller::crd::VaultResource;
use schemars::schema_for;
fn main() {
    print!(
        "{}",
        serde_json::to_string_pretty(&schema_for!(VaultResource)).unwrap()
    )
}
