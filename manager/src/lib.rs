pub mod config;
pub mod internal_config;
pub mod machines;
pub mod macros;
pub mod public_ip;
pub mod ssh;
pub mod tasks;
pub mod tracing;
pub mod types;
pub mod utils;

pub mod providers {
    pub mod hcloud {
        pub mod index;
        pub mod machine;
    }
    pub mod qemu {
        pub mod machine;
    }
    pub mod local_physical {
        pub mod machine;
        pub mod video;
    }
}
pub mod os {
    pub mod cloud_init;
    pub mod pixiecore;
}

pub mod cluster {
    pub mod cluster;
    pub mod network;
    pub mod node;
    pub mod secrets;
    pub mod storage;
}

pub mod api {
    pub mod boot;
    pub mod cluster;
    pub mod config;
    pub mod direct_terminal;
    pub mod machines;
    pub mod public_ip;
    pub mod health;
}
