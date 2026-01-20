use filez_server_lib::kubernetes_controller::crd::FilezResource;
use kube::CustomResourceExt;
fn main() {
    print!("{}", serde_yaml_neo::to_string(&FilezResource::crd()).unwrap())
}
