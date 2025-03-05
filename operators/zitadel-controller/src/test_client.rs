use tonic::service;
use zitadel::{
    api::{
        clients::{ChannelConfig, ClientBuilder},
        zitadel::management::v1::{GetIamRequest, GetMyOrgRequest},
    },
    credentials::ServiceAccount,
};

#[tokio::main]
pub async fn main() -> anyhow::Result<()> {
    // kubectl port-forward -n mows-core-auth-zitadel service/zitadel --address 0.0.0.0 8080:http2-server
    let ca_cert = r#"-----BEGIN CERTIFICATE-----
MIIBjTCCATOgAwIBAgIUSXM1iw/cDynz/RVqBtYR5m8x7f0wCgYIKoZIzj0EAwIw
JDEQMA4GA1UEAwwHeml0YWRlbDEQMA4GA1UECgwHeml0YWRlbDAeFw0yNTAzMDQx
ODQ0NTRaFw0yNjAzMDQxODQ0NTRaMCQxEDAOBgNVBAMMB3ppdGFkZWwxEDAOBgNV
BAoMB3ppdGFkZWwwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAARgdvVFk8owUOAC
dqRnHsfWjSVljREKAYuN2Izp7Q+M0u5i5iM53v8JKK39p2/282Mmp4Y/4Ulx+ES4
59lbvqnxo0MwQTAPBgNVHQ8BAf8EBQMDB4YAMB0GA1UdDgQWBBQyENbcx4NTUbTw
DVZc1GFVqxzcujAPBgNVHRMBAf8EBTADAQH/MAoGCCqGSM49BAMCA0gAMEUCIGg0
4PgdeY0jrTUeV0jqhGQl3D7wJcRgrfOH5tuKg/UJAiEAi3UDCWp+aLoPf+MkYSAR
SoxJG2uDgkreH9Du9f0h5DQ=
-----END CERTIFICATE-----"#;

    let sa_token = r#"{"type":"serviceaccount","keyId":"309737739979980902","key":"-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEAvbDsgjqOUXYrxw0n1FC6kxfmwEM0yf9L2nm9gMKNB7Q0ivVr\nhB2neMczkjhaXNWQcMWEHzPut5u5nPMyNAVd7QG2gCoipLEcQBLJhwCRll9msYEm\nd7LVG4prhHwA7cO+h2MSx80E26pHpcTF+RvWzLfj/1LR7sOg8pg3ZdITfvvv4YaX\nCwgV3hs5usqgzNkBHMQOIFRtbhrf8FFWywVulMwrpCVLOaxxrqDM+MbKLsMgac3o\n0N4NZsjMRgqykIwp6ghNgjReO+Fu+E+iAVqq5odw6Zz4VudCbE0zRjaH7KEQl4Pn\nUtu8u4H8aCgucf+RQlAJb3jT93DDya11ThYbIQIDAQABAoIBAQCkWbwxASb5sZcw\neVd+/wsIEvdcsV31ffpsqnnkK6whdqLnmseyyjal0IIAOE8ii+7/pkJY/pfgAU6K\ni7N9mwDMLmW/GcK2SrWdVinBjF6XmMTTGoEHyKwXlpCdUwtC9gwIJXDKJ/oDkL9P\nAvQ8Z0BuUw151HoLkvfJ+NRWpfM6WvO1rjAdi6yuzXFXuqIrmW3SPaTViRoSMoME\nYH6yGvUKOXKedsMPKWpbdlSlswdpvqucD3XgC/5Gz1jzFs5yXvCpNE+KDsI30bXu\nMAlDKkrQ/xLISJkdxoJyiSIMFngECopm0afecHhiJF9sUi6tylC4QVehpys+tSiQ\nDN343IQ5AoGBAM3SlIUXPW5y4n+R3R5k88PfOdTwSMsZay6bpwx84584Yy4OYglR\ni2RmHLpKHeHsdfDBlIu/ufVHDLPQ9Mkgdmn25BapJmJL54kAumuErXkLVpHPWyAe\nSf8Q2Iu+ZzNV7Dx1Sgrw1BQ31bGmi2+9gt71JxxkVla4y2T/0PAmIDRHAoGBAOvv\nk3u7M8W/6ssIyFChmw84KxJfmeDNp6vRPtbr9QklLdzYSuIn/CXQfQDRzy3dxXBi\n7t2o595d6IOajVWXOvL1PO9zN0fNqHML8XoHCyRxNM3K/ffAcC1qEKUXJl7ZAWO2\nnhlfgz2iPv2YXt290K2Qn9U3W/WMn2eC78xa53FXAoGADlIoo1oKnDTCLb4odITx\nsR9HFtnhNsB+BLAv316RN/Lkc7/sclmKKWIxfYTKr32UdzwA6fhdKAPZjmlrntLz\nakwTcsAyO4Ssh4vVbMW+jD2NuHeFD6cL3wN9Dbwh0iCYX1yJ2lkHaKC57bJ44T1+\nbaUBI6iXmVEiVdS25P7CHuECgYEAn6AztF7vpDc4b629eXAdLKrf2Up9Ha+GZaTo\nUxjJbCqPYP+limVrH1pzeH57IZkN3//PhICmf7ghfAiw3tu2snJhi8/z8sydz1ih\nQ+JIE5vUEffo5Bp6yv8by9Zhy4IegownYxtP+/8thv30ESo/aW6T9PnDadp+btYT\nz7shI3kCgYAA3+fjEXgYu+3HLmDYOp/zmr9BDdqheHVkP77zdhJhf7i5SL0deh8u\nLKpv9XkyMsP9wy+z9qTcr2glvemodPT4PhqEh4R/htGSky9B7Krkb1Mmx2qAOjve\n6IQw/1mgHQQ5pebMSEnKrhDjHoNKbHQXcmGFY4Cnw8l/yIBSgjzXyA==\n-----END RSA PRIVATE KEY-----\n","expirationDate":"9999-12-31T23:59:59Z","userId":"309737739979915366"}

"#;

    let channel_config = ChannelConfig {
        ca_certificate_pem: ca_cert.to_string(),
        origin: "https://zitadel.vindelicorum.eu".to_string(),
        tls_domain_name: "zitadel".to_string(),
    };

    let pat = "5VVQyA2woNd5vMSW6pN9RsI3Qo3pNDrOLUSVNcNDLmCHueatXlvrOIHYm3aSUe17nG1Z-XM";

    let service_account = ServiceAccount::load_from_json(sa_token)
        .map_err(|e| anyhow::anyhow!("Failed to load service account: {}", e))?;

    let client_builder = ClientBuilder::new("http://localhost:8080").with_access_token(pat); //.with_service_account(&service_account, None);

    let mut client = client_builder
        .build_management_client(&channel_config)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to create client: {}", e))?;

    let res = client.get_iam(GetIamRequest {}).await?;

    println!("{:?}", res);

    Ok(())
}
