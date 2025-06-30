use controller::crd::PektinResource;
use kube::CustomResourceExt;
fn main() {
    print!("{}", serde_yaml::to_string(&PektinResource::crd()).unwrap())
}
