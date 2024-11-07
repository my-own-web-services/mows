use controller::crd::PektinDns;
use kube::CustomResourceExt;
fn main() {
    print!("{}", serde_yaml::to_string(&PektinDns::crd()).unwrap())
}
