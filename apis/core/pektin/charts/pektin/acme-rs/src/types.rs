use rcgen::Certificate;
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Directory {
    #[serde(rename = "newAccount")]
    pub new_account: String,
    #[serde(rename = "newNonce")]
    pub new_nonce: String,
    #[serde(rename = "newOrder")]
    pub new_order: String,
    #[serde(rename = "renewalInfo")]
    pub renewal_info: Option<String>,
    #[serde(rename = "revokeCert")]
    pub revoke_cert: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct CreatedAccountResponse {
    pub status: String,
    #[serde(rename = "initialIp")]
    pub initital_ip: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: Option<String>,
    pub contact: Vec<String>,
    pub key: JsonWebKey,
    pub key_id: String,
}

// SORTING in lexicographic order IS SUPER IMPORTANT HERE
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct JsonWebKey {
    pub crv: String,
    pub kty: String,
    pub x: String,
    pub y: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct OrderResponse {
    pub status: String,
    pub expires: String,
    pub identifiers: Vec<Identifier>,
    pub authorizations: Vec<String>,
    pub finalize: String,
    pub certificate: Option<String>,
    pub location: Option<String>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Identifier {
    #[serde(rename = "type")]
    pub ident_type: String,
    pub value: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct ChallengesResponse {
    pub status: String,
    pub expires: String,
    pub challenges: Vec<Challenge>,
    pub identifier: Identifier,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct Challenge {
    #[serde(rename = "type")]
    pub challenge_type: String,
    pub url: String,
    pub token: String,
    pub status: String,
    pub validated: Option<String>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct FinalizeResponse {
    pub status: String,
    pub expires: String,
    pub authorizations: Vec<String>,
    pub identifiers: Vec<Identifier>,
    pub retry_after: Option<String>,
    pub finalize: String,
    pub certificate: Option<String>,
}
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct UserChallenges {
    pub dns: Vec<UserDnsChallenge>,
}
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct UserDnsChallenge {
    pub name: String,
    pub value: String,
    pub url: String,
}
