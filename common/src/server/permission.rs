use super::{
    file::FilezFile, file_group::FilezFileGroup, user::FilezUser, user_group::FilezUserGroup,
};

#[typetag::serde(tag = "type")]
pub trait PermissiveResource: Send + Sync {
    fn get_permission_ids(&self) -> &Vec<String>;
    fn get_owner_id(&self) -> &String;
}

#[typetag::serde]
impl PermissiveResource for FilezFile {
    fn get_permission_ids(&self) -> &Vec<String> {
        &self.permission_ids
    }

    fn get_owner_id(&self) -> &String {
        &self.owner_id
    }
}
#[typetag::serde]
impl PermissiveResource for FilezFileGroup {
    fn get_permission_ids(&self) -> &Vec<String> {
        &self.permission_ids
    }

    fn get_owner_id(&self) -> &String {
        &self.owner_id
    }
}
#[typetag::serde]
impl PermissiveResource for FilezUserGroup {
    fn get_permission_ids(&self) -> &Vec<String> {
        &self.permission_ids
    }

    fn get_owner_id(&self) -> &String {
        &self.owner_id
    }
}
#[typetag::serde]
impl PermissiveResource for FilezUser {
    fn get_permission_ids(&self) -> &Vec<String> {
        &self.permission_ids
    }

    fn get_owner_id(&self) -> &String {
        &self.user_id
    }
}
