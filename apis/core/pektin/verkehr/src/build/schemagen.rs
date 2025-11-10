use schemars::schema_for;
use verkehr::kubernetes_controller::crd::VerkehrResource;
fn main() {
    print!(
        "{}",
        serde_json::to_string_pretty(&schema_for!(VerkehrResource)).unwrap()
    )
}
