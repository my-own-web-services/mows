#[macro_export]
macro_rules! some_or_bail {
    ( $option:expr, $message:expr ) => {{
        if let Some(val) = $option {
            val
        } else {
            anyhow::bail!($message)
        }
    }};
}

#[macro_export]
macro_rules! get_current_config_cloned {
    () => {{
        tracing::debug!(target: "manager::config_locks","Trying to read config: {} {}", file!(), line!());
        let cfg_lock = crate::config::config().read().await.clone();
        tracing::debug!(target: "manager::config_locks","Got config: {} {}", file!(), line!());
        cfg_lock
    }};
}

#[macro_export]
macro_rules! write_config {
    ( ) => {{
        tracing::debug!(target: "manager::config_locks","Writing config: {} {}", file!(), line!());
        crate::config::config().write().await
    }};
}

#[macro_export]
macro_rules! s {
    ($str:expr) => {
        $str.to_string()
    };
}
