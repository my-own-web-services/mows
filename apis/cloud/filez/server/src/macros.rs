#[macro_export]
macro_rules! with_timing {
    ($function:expr, $description:expr,$timing:expr) => {{
        #[cfg(feature = "timing")]
        let start = std::time::Instant::now();

        let result = $function;

        #[cfg(feature = "timing")]
        let function_name = stringify!($function)
            .split('(')
            .next()
            .unwrap_or(stringify!($function))
            .trim()
            .replace("::", "_")
            .replace(".", "_");
        #[cfg(feature = "timing")]
        $timing.lock().unwrap().record_timing(
            function_name.to_string(),
            start.elapsed(),
            Some($description.to_string()),
        );

        result
    }};
}
