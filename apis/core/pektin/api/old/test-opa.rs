use std::time::{SystemTime, UNIX_EPOCH};

use vault::login_userpass;

use crate::vault::get_pear_policy;

mod opa;
mod vault;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let endpoint = "http://127.0.0.1:8200";

    let vault_token = login_userpass(endpoint, "pektin-api", "vw6eHCp8e1TXFbjBoeP0OXOG8XdGNTri0aN9ZkfXA96kpOs7_wTAbIo4PyzeemdAByJ5ooiu91Bry5g0Xt8bZrmJyKaT2ppBHaU8jDgmMmGO9HY0MvKxKdWtwXIaP1QxxLeGtw").await;

    let pear_policy = get_pear_policy(
        endpoint,
        vault_token.unwrap(),
        "pektin-admin-yx5bQldkgIpyRg",
    )
    .await;

    let evaluated = run_opa_eval(pear_policy.unwrap()).await;
    println!("{:?}", evaluated);
    Ok(())
}

pub async fn run_opa_eval(policy: String) {
    let start = SystemTime::now();
    let time_now_millis = start
        .duration_since(UNIX_EPOCH)
        .expect("Time went backwards")
        .as_millis();

    let res = opa::evaluate(
        "http://127.0.0.1:8081",
        policy,
        opa::OpaRequestData {
            domain: String::from("_acme-challenge.y.gy."),
            api_methods: String::from("set"),
            rr_types: String::from("TXT"),
            value: String::from("kdf9j3898989r34rj890dewkio"),
            ip: "::1".parse().unwrap(),
            utc_millis: time_now_millis,
        },
    )
    .await;
    println!("{:?}", res);
}
