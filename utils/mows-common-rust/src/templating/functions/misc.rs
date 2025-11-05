use gtmpl::{FuncError, Value};
use uuid::Uuid;

/// Generate a UUID v4
pub fn uuidv4(_args: &[Value]) -> Result<Value, FuncError> {
    let uuid = Uuid::new_v4();
    Ok(Value::String(uuid.to_string()))
}

/// Required value - fails if value is empty
pub fn required(args: &[Value]) -> Result<Value, FuncError> {
    let message = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let value = args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    match value {
        Value::Nil | Value::NoValue => Err(FuncError::Generic(message.to_string())),
        Value::String(s) if s.is_empty() => Err(FuncError::Generic(message.to_string())),
        Value::Array(a) if a.is_empty() => Err(FuncError::Generic(message.to_string())),
        _ => Ok(value.clone()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_uuidv4() {
        let result = uuidv4(&[]).unwrap();
        let uuid_str = result.to_string();

        // UUID should be 36 characters (with dashes)
        assert_eq!(uuid_str.len(), 36);
        assert!(uuid_str.contains('-'));

        // Should have correct format: 8-4-4-4-12
        let parts: Vec<&str> = uuid_str.split('-').collect();
        assert_eq!(parts.len(), 5);
        assert_eq!(parts[0].len(), 8);
        assert_eq!(parts[1].len(), 4);
        assert_eq!(parts[2].len(), 4);
        assert_eq!(parts[3].len(), 4);
        assert_eq!(parts[4].len(), 12);
    }

    #[test]
    fn test_required_with_value() {
        let result = required(&[
            Value::String("error message".to_string()),
            Value::String("value".to_string()),
        ])
        .unwrap();
        assert_eq!(result.to_string(), "value");
    }

    #[test]
    fn test_required_without_value() {
        let result = required(&[
            Value::String("error message".to_string()),
            Value::Nil,
        ]);
        assert!(result.is_err());
    }

    #[test]
    fn test_required_with_empty_string() {
        let result = required(&[
            Value::String("error message".to_string()),
            Value::String("".to_string()),
        ]);
        assert!(result.is_err());
    }
}
