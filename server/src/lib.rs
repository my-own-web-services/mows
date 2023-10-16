pub mod config;
pub mod db;
pub mod dynamic_groups;
pub mod internal_types;
pub mod interossea;
pub mod macros;
pub mod readonly_mount;
pub mod types;
pub mod utils;

pub mod methods {
    pub mod create_file;
    pub mod create_group;
    pub mod create_permission;
    pub mod create_upload_space;
    pub mod create_user;
    pub mod delete_file;
    pub mod delete_group;
    pub mod delete_permission;
    pub mod get_aggregated_keywords;
    pub mod get_file;
    pub mod get_file_info;
    pub mod get_file_infos_by_group_id;
    pub mod get_own_file_groups;
    pub mod get_permissions_for_current_user;
    pub mod get_user_info;
    pub mod search;
    pub mod set_app_data;
    pub mod update_file;
    pub mod update_file_group;
    pub mod update_file_infos;
    pub mod update_permission_ids_on_resource;
}
