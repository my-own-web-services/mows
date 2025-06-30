use schemars::schema_for;
use server_lib::controller::crd::FilezResource;
fn main() {
    print!(
        "{}",
        serde_json::to_string_pretty(&schema_for!(FilezResource)).unwrap()
    )
}
