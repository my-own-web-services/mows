use controller::crd::VaultResource;
use kube::CustomResourceExt;
fn main() {
    print!("{}", serde_yaml_neo::to_string(&VaultResource::crd()).unwrap())
}
