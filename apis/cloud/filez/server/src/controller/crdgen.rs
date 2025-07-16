use filez_server_lib::controller::crd::FilezResource;
use kube::CustomResourceExt;
fn main() {
    print!("{}", serde_yaml::to_string(&FilezResource::crd()).unwrap())
}
