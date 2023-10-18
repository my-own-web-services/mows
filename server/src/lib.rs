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
    pub mod file {
        pub mod info {
            pub mod get;
            pub mod update;
        }
        pub mod create;
        pub mod delete;
        pub mod get;
        pub mod set_app_data;
        pub mod update;
    }
    pub mod group {
        pub mod create;
        pub mod delete;
    }
    pub mod permission {
        pub mod create;
        pub mod delete;
    }
    pub mod upload_space {
        pub mod create;
    }
    pub mod user {
        pub mod create;
        pub mod get;
    }
    pub mod file_group {
        pub mod update;
    }

    pub mod get_aggregated_keywords;
    pub mod get_file_infos_by_group_id;
    pub mod get_own_file_groups;
    pub mod get_permissions_for_current_user;
    pub mod get_user_list;
    pub mod update_permission_ids_on_resource;
}
