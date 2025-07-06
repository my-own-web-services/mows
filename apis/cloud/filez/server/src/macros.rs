#[macro_export]
macro_rules! with_timing {
    ($function:expr, $description:expr,$timing:expr) => {{
        let result = $function;

        #[cfg(feature = "timing")]
        let function_name = stringify!($function)
            .split('(')
            .next()
            .unwrap_or(stringify!($function));
        #[cfg(feature = "timing")]
        $timing
            .lock()
            .unwrap()
            .record(function_name.to_string(), Some($description.to_string()));

        result
    }};
}
