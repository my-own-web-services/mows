use controller::crd::PektinResource;
use kube::CustomResourceExt;
fn main() {
    print!("{}", serde_yaml_neo::to_string(&PektinResource::crd()).unwrap())
}
