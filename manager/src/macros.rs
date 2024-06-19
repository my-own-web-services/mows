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
        tracing::debug!("Trying to read config: {} {}", file!(), line!());
        let cfg_lock = crate::config::config().read().await.clone();
        tracing::debug!("Got config: {} {}", file!(), line!());
        cfg_lock
    }};
}

#[macro_export]
macro_rules! write_config {
    ( ) => {{
        tracing::debug!("Writing config: {} {}", file!(), line!());
        crate::config::config().write().await
    }};
}
