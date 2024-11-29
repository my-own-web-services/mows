pub mod config;
pub mod dev;
pub mod errors;
pub mod db {
    pub mod db;
    pub mod models;
    pub mod schema;
}
pub mod repository;
pub mod types;
pub mod ui;
pub mod utils;
pub mod api {
    pub mod health;
    pub mod repository;
}
