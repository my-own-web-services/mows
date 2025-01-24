use controller::crd::ZitadelResource;
use kube::CustomResourceExt;
fn main() {
    print!("{}", serde_yaml::to_string(&ZitadelResource::crd()).unwrap())
}
