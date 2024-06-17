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
        let config_locked_abc = CONFIG.read_err().await?;
        let cfg_abc = config_locked_abc.clone();
        drop(config_locked_abc);
        cfg_abc
    }};
}
