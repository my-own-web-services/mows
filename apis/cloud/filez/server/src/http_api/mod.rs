pub mod files {
    pub mod create;
    pub mod delete;
    pub mod get;
    pub mod update;
}

pub mod file_versions {
    pub mod create;
    pub mod delete;
    pub mod get;
    pub mod update;
    pub mod content {
        pub mod get;
        pub mod tus {
            pub mod head;
            pub mod patch;
        }
    }
}

pub mod users {
    pub mod create;
    pub mod delete;
    pub mod get;
    pub mod get_own;
    pub mod list;
    pub mod update;
}

pub mod access_policies {
    pub mod check_resource_access;
    pub mod create;
    pub mod delete;
    pub mod get;
    pub mod list;
    pub mod update;
}

pub mod user_groups {
    pub mod create;
    pub mod delete;
    pub mod get;
    pub mod list;
    pub mod list_users;
    pub mod update;
    pub mod update_members;
}

pub mod file_groups {
    pub mod create;
    pub mod delete;
    pub mod get;
    pub mod list;
    pub mod list_files;
    pub mod update;
    pub mod update_members;
}

pub mod apps {
    pub mod get;
    pub mod list;
}

pub mod storage_quotas {
    pub mod create;
    pub mod delete;
    pub mod get;
    pub mod get_usage;
    pub mod list;
    pub mod update;
}

pub mod storage_locations {
    pub mod list;
}

pub mod tags {
    pub mod get;
    pub mod list;
    pub mod update;
}

pub mod jobs {
    pub mod create;
    pub mod delete;
    pub mod get;
    pub mod list;
    pub mod update;
    pub mod apps {
        pub mod pickup;
        pub mod update_status;
    }
}

pub mod authentication;
pub mod health;

pub mod dev {
    pub mod reset_database;
}
