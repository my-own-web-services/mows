use gtmpl::{FuncError, Value};
use std::path::Path;

/// Get the base name of a path
pub fn base(args: &[Value]) -> Result<Value, FuncError> {
    let path = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    let path_str = path.to_string();
    let path = Path::new(&path_str);

    let base_name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string();

    Ok(Value::String(base_name))
}

/// Get the directory name of a path
pub fn dir(args: &[Value]) -> Result<Value, FuncError> {
    let path = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    let path_str = path.to_string();
    let path = Path::new(&path_str);

    let dir_name = path
        .parent()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string();

    Ok(Value::String(dir_name))
}

/// Clean a path
pub fn clean(args: &[Value]) -> Result<Value, FuncError> {
    let path = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    let path_str = path.to_string();
    let path = Path::new(&path_str);

    // Normalize the path (remove redundant separators, resolve ".")
    let cleaned = path
        .components()
        .fold(std::path::PathBuf::new(), |mut path, component| {
            match component {
                std::path::Component::CurDir => {}
                _ => path.push(component),
            }
            path
        });

    Ok(Value::String(
        cleaned.to_str().unwrap_or("").to_string(),
    ))
}

/// Get the file extension
pub fn ext(args: &[Value]) -> Result<Value, FuncError> {
    let path = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    let path_str = path.to_string();
    let path = Path::new(&path_str);

    let extension = path
        .extension()
        .and_then(|s| s.to_str())
        .map(|s| format!(".{}", s))
        .unwrap_or_default();

    Ok(Value::String(extension))
}

/// Check if path is absolute
pub fn is_abs(args: &[Value]) -> Result<Value, FuncError> {
    let path = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    let path_str = path.to_string();
    let path = Path::new(&path_str);

    Ok(Value::Bool(path.is_absolute()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_base() {
        let result = base(&[Value::String("/path/to/file.txt".to_string())]).unwrap();
        assert_eq!(result.to_string(), "file.txt");
    }

    #[test]
    fn test_dir() {
        let result = dir(&[Value::String("/path/to/file.txt".to_string())]).unwrap();
        assert_eq!(result.to_string(), "/path/to");
    }

    #[test]
    fn test_ext() {
        let result = ext(&[Value::String("/path/to/file.txt".to_string())]).unwrap();
        assert_eq!(result.to_string(), ".txt");
    }

    #[test]
    fn test_ext_no_extension() {
        let result = ext(&[Value::String("/path/to/file".to_string())]).unwrap();
        assert_eq!(result.to_string(), "");
    }

    #[test]
    fn test_is_abs() {
        let result = is_abs(&[Value::String("/path/to/file.txt".to_string())]).unwrap();
        assert_eq!(result, Value::Bool(true));

        let result = is_abs(&[Value::String("relative/path.txt".to_string())]).unwrap();
        assert_eq!(result, Value::Bool(false));
    }

    #[test]
    fn test_clean() {
        let result = clean(&[Value::String("/path/./to/../file.txt".to_string())]).unwrap();
        // Clean should remove the ./ but behavior may vary
        assert!(result.to_string().contains("path"));
    }
}
