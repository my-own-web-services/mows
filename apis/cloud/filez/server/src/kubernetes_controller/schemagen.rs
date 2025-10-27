use filez_server_lib::kubernetes_controller::crd::FilezResource;
use schemars::schema_for;
fn main() {
    print!(
        "{}",
        serde_json::to_string_pretty(&schema_for!(FilezResource)).unwrap()
    )
}
