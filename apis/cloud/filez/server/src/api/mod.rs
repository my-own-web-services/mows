pub mod files {
    pub mod meta {
        pub mod get;
        pub mod update;
    }
    pub mod versions {
        pub mod create;
        pub mod get;
        pub mod tus {
            pub mod head;
            pub mod patch;
        }
    }
    pub mod create;
}
pub mod users {
    pub mod apply;
    pub mod get;
}

pub mod auth {
    pub mod check_resource_access;
}

pub mod user_groups;

pub mod file_groups {
    pub mod create;
    pub mod delete;
    pub mod get;
    pub mod list;
    pub mod list_files;
    pub mod update;
}
pub mod health;
