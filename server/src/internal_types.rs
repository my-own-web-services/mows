use crate::interossea::UserAssertion;
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct Auth {
    pub authenticated_user: Option<String>,
    pub token: Option<String>,
    pub user_assertion: Option<UserAssertion>,
}
