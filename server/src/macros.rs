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
macro_rules! get_acl {
    ( $s:expr, $field:expr ) => {
        match $field {
            "get_file" => $s.get_file,
            "update_file" => $s.update_file,
            "delete_file" => $s.delete_file,
            "get_file_info" => $s.get_file_info,
            _ => panic!("unknown field"),
        }
    };
}
