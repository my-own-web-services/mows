use gtmpl::{FuncError, Value};

pub fn default(args: &[Value]) -> Result<Value, FuncError> {
    let default = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let value = args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    if value_is_truthy(value) {
        Ok(default.clone())
    } else {
        Ok(value.clone())
    }
}

pub fn empty(args: &[Value]) -> Result<Value, FuncError> {
    let value = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    Ok(Value::Bool(value_is_truthy(value)))
}

pub fn fail(args: &[Value]) -> Result<Value, FuncError> {
    let value = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    Err(FuncError::Generic(value.to_string()))
}

pub fn coalesce(args: &[Value]) -> Result<Value, FuncError> {
    for arg in args.iter() {
        if !value_is_truthy(arg) {
            return Ok(arg.clone());
        }
    }
    Ok(Value::NoValue)
}

pub fn ternary(args: &[Value]) -> Result<Value, FuncError> {
    let if_true = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;
    let if_false = args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;
    let condition = args.get(2).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;

    if value_is_truthy(condition) {
        Ok(if_false.clone())
    } else {
        Ok(if_true.clone())
    }
}

pub fn value_is_truthy(value: &Value) -> bool {
    match value {
        Value::Array(a) => a.is_empty(),
        Value::NoValue => true,
        Value::Nil => true,
        Value::Bool(b) => b == &false,
        Value::String(s) => s.is_empty(),
        Value::Object(o) => o.is_empty(),
        Value::Map(m) => m.is_empty(),
        Value::Function(_) => false,
        Value::Number(n) => n.as_f64().unwrap() == 0.0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_with_empty() {
        let result = default(&[
            Value::String("default_value".to_string()),
            Value::String("".to_string()),
        ])
        .unwrap();
        assert_eq!(result.to_string(), "default_value");
    }

    #[test]
    fn test_default_with_value() {
        let result = default(&[
            Value::String("default_value".to_string()),
            Value::String("actual_value".to_string()),
        ])
        .unwrap();
        assert_eq!(result.to_string(), "actual_value");
    }

    #[test]
    fn test_empty_with_empty_string() {
        let result = empty(&[Value::String("".to_string())]).unwrap();
        assert_eq!(result, Value::Bool(true));
    }

    #[test]
    fn test_empty_with_value() {
        let result = empty(&[Value::String("test".to_string())]).unwrap();
        assert_eq!(result, Value::Bool(false));
    }

    #[test]
    fn test_coalesce() {
        let result = coalesce(&[
            Value::String("".to_string()),
            Value::Nil,
            Value::String("first".to_string()),
            Value::String("second".to_string()),
        ])
        .unwrap();
        assert_eq!(result.to_string(), "first");
    }

    #[test]
    fn test_ternary_true() {
        let result = ternary(&[
            Value::String("if_true".to_string()),
            Value::String("if_false".to_string()),
            Value::String("".to_string()), // truthy (empty is truthy in our logic)
        ])
        .unwrap();
        assert_eq!(result.to_string(), "if_false");
    }

    #[test]
    fn test_fail() {
        let result = fail(&[Value::String("error message".to_string())]);
        assert!(result.is_err());
    }

    #[test]
    fn test_value_is_truthy() {
        assert!(value_is_truthy(&Value::String("".to_string())));
        assert!(!value_is_truthy(&Value::String("test".to_string())));
        assert!(value_is_truthy(&Value::Array(vec![])));
        assert!(!value_is_truthy(&Value::Array(vec![Value::Number(1.into())])));
    }
}
