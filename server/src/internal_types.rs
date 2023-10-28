use crate::interossea::UserAssertion;
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct Auth {
    pub authenticated_ir_user_id: Option<String>,
    pub password: Option<String>,
    pub user_assertion: Option<UserAssertion>,
}
