#[macro_export]
macro_rules! get_current_config_cloned {
    () => {{
        tracing::debug!(target: "vault-resource-controller::config_locks","Trying to read config: {} {}", file!(), line!());
        let cfg_lock = crate::config::config().read().await.clone();
        tracing::debug!(target: "vault-resource-controller::config_locks","Got config: {} {}", file!(), line!());
        cfg_lock
    }};
}

#[macro_export]
macro_rules! write_config {
    ( ) => {{
        tracing::debug!(target: "vault-resource-controller::config_locks","Writing config: {} {}", file!(), line!());
        crate::config::config().write().await
    }};
}
