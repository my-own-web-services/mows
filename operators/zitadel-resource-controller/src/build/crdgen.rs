use kube::CustomResourceExt;
use zitadel_resource_controller::crd::ZitadelResource;
fn main() {
    print!("{}", serde_yaml::to_string(&ZitadelResource::crd()).unwrap())
}
