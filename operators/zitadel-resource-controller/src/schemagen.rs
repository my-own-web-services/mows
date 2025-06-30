use schemars::schema_for;
use zitadel_resource_controller::crd::ZitadelResource;
fn main() {
    print!(
        "{}",
        serde_json::to_string_pretty(&schema_for!(ZitadelResource)).unwrap()
    )
}
