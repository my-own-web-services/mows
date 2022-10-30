#[derive(Debug, Eq, PartialEq, Clone)]
pub struct Auth {
    pub authenticated_user: Option<String>,
    pub token: Option<String>,
}
