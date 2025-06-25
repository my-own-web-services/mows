use kube::CustomResourceExt;
use server_lib::controller::crd::FilezResource;
fn main() {
    print!("{}", serde_yaml::to_string(&FilezResource::crd()).unwrap())
}
