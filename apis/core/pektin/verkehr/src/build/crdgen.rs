use kube::CustomResourceExt;
use verkehr::kubernetes_controller::crd::VerkehrResource;
fn main() {
    print!(
        "{}",
        serde_yaml_neo::to_string(&VerkehrResource::crd()).unwrap()
    )
}
