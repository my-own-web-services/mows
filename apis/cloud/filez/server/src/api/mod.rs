pub mod files {
    pub mod meta {
        pub mod get;
        pub mod update;
    }
    pub mod create;

    pub mod get;
}
pub mod users {
    pub mod apply;
    pub mod get;
}

pub mod auth {
    pub mod check_resource_access;
}

pub mod user_groups {}

pub mod file_groups {
    pub mod list_files;
}
pub mod health;
