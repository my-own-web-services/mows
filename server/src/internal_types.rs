use crate::{interossea::UserAssertion, types::FilezPermissionAcl};
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
pub struct Auth {
    pub authenticated_user: Option<String>,
    pub token: Option<String>,
    pub user_assertion: Option<UserAssertion>,
}

#[derive(Debug, Eq, PartialEq, Clone)]
pub struct MergedFilezPermission {
    pub ribston: Vec<String>,
    pub acl: Option<FilezPermissionAcl>,
}
