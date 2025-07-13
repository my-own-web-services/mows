pub mod files {
    pub mod meta {
        pub mod get;
        pub mod update;
    }
    pub mod versions {
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
    pub mod create;
    pub mod delete;
    pub mod get;
    pub mod update;
}
pub mod users {
    pub mod apply;
    pub mod create;
    pub mod delete;
    pub mod get;
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

pub mod storage_quotas {
    pub mod create;
    pub mod delete;
    pub mod get;
    pub mod list;
    pub mod update;
}

pub mod health;
