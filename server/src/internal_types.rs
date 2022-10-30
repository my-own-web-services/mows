use crate::types::FilezPermissionAcl;

#[derive(Debug, Eq, PartialEq, Clone)]
pub struct Auth {
    pub authenticated_user: Option<String>,
    pub token: Option<String>,
}

#[derive(Debug, Eq, PartialEq, Clone)]
pub struct MergedFilezPermission {
    pub ribston: Vec<String>,
    pub acl: Option<FilezPermissionAcl>,
}
