pub mod auth;
pub mod config;
pub mod db;
pub mod internal_types;
pub mod macros;
pub mod types;
pub mod utils;

pub mod methods {
    pub mod create_file;
    pub mod create_group;
    pub mod create_permission;
    pub mod delete_file;
    pub mod delete_group;
    pub mod delete_permission;
    pub mod get_file;
    pub mod get_file_info;
    pub mod get_file_infos_by_group_id;
    pub mod get_permissions_for_current_user;
    pub mod get_user_info;
    pub mod set_app_data;
    pub mod update_file;
    pub mod update_permission_ids_on_resource;
}
