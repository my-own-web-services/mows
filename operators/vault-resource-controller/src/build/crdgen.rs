use controller::crd::VaultResource;
use kube::CustomResourceExt;
fn main() {
    print!("{}", serde_yaml::to_string(&VaultResource::crd()).unwrap())
}
