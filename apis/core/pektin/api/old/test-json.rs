use pektin_api::SetRequestBody;
use pektin_common::proto::rr::rdata::SOA;
use pektin_common::proto::rr::Name;
use pektin_common::{RedisEntry, RrSet, SoaRecord};
use std::error::Error;

fn main() -> Result<(), Box<dyn Error>> {
    let soa = SOA::new(
        Name::from_ascii("pektin.xyz.").unwrap(),
        Name::from_ascii("hostmaster.pektin.xyz.").unwrap(),
        2021012201,
        3600,
        3600,
        3600,
        3600,
    );

    let req = SetRequestBody {
        client_username: "user".into(),
        confidant_password: "password".into(),
        records: vec![RedisEntry {
            name: Name::from_ascii("pektin.xyz.").unwrap(),
            rr_set: RrSet::SOA {
                rr_set: vec![SoaRecord {
                    ttl: 3600,
                    value: soa,
                }],
            },
        }],
    };

    println!("{}", serde_json::to_string_pretty(&req).unwrap());

    let parsed_req = serde_json::from_str::<SetRequestBody>(
        r#"{
    "confidant_password": "<REDACTED>",
    "client_username": "<REDACTED>",
    "records": [
        {
            "name": "pektin.xyz.",
            "rr_type": "NS",
            "rr_set": [
                {
                    "ttl": 60,
                    "value": "ns1.pektin.xyz."
                }
            ]
        }
    ]
}"#,
    )
    .unwrap();
    dbg!(parsed_req);

    Ok(())
}
