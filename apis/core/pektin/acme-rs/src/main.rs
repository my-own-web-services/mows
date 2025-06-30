use lib::types::{Identifier, UserChallenges};
use lib::AcmeClient;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let email = "acme-test@y.gy";
    //let endpoint = "https://localhost:14000/dir";
    let endpoint = "https://acme-staging-v02.api.letsencrypt.org/directory";
    //let endpoint = "https://acme-v02.api.letsencrypt.org/directory";
    let identifiers = vec![Identifier {
        value: "y.gy".to_string(),
        ident_type: "dns".to_string(),
    }];

    let mut client = AcmeClient::new(endpoint, email).await?;

    let cert = client.create_certificate_with_defaults(&identifiers)?;

    let signed_cert = client
        .sign_certificate(&cert, &identifiers, handle_challenges_manually)
        .await?;

    println!("{:?}", signed_cert);

    Ok(())
}

pub async fn handle_challenges_manually(
    user_challenges: UserChallenges,
) -> anyhow::Result<Vec<String>> {
    // handle challenges here

    let mut fulfilled = Vec::new();
    for challenge in user_challenges.dns {
        println!("{:?}", challenge);
        fulfilled.push(challenge.url.to_string());
    }
    println!("Press enter to continue");
    std::io::stdin().read_line(&mut String::new()).ok();

    Ok(fulfilled)
}
