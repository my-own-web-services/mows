use gtmpl::{FuncError, Value};

/// Convert string to integer
pub fn atoi(args: &[Value]) -> Result<Value, FuncError> {
    let value = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    let value = value.to_string();
    let parsed = value
        .trim()
        .parse::<i64>()
        .map_err(|_| FuncError::Generic("Invalid integer".to_string()))?;
    Ok(Value::Number(parsed.into()))
}

/// Convert to float64
pub fn float64(args: &[Value]) -> Result<Value, FuncError> {
    let value = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    let value = value.to_string();
    let parsed = value
        .trim()
        .parse::<f64>()
        .map_err(|_| FuncError::Generic("Invalid float".to_string()))?;
    Ok(Value::Number(parsed.into()))
}

/// Convert to int
pub fn int(args: &[Value]) -> Result<Value, FuncError> {
    atoi(args)
}

/// Convert to int64
pub fn int64(args: &[Value]) -> Result<Value, FuncError> {
    atoi(args)
}

/// Convert to string
pub fn to_string(args: &[Value]) -> Result<Value, FuncError> {
    let value = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    Ok(Value::String(value.to_string()))
}

/// Convert array to strings
pub fn to_strings(args: &[Value]) -> Result<Value, FuncError> {
    let value = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    match value {
        Value::Array(arr) => {
            let strings: Vec<Value> = arr.iter().map(|v| Value::String(v.to_string())).collect();
            Ok(Value::Array(strings))
        }
        _ => Err(FuncError::Generic("Argument must be an array".to_string())),
    }
}

/// Get the type of a value
pub fn type_of(args: &[Value]) -> Result<Value, FuncError> {
    let value = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    let type_name = match value {
        Value::Nil => "nil",
        Value::Bool(_) => "bool",
        Value::Number(_) => "number",
        Value::String(_) => "string",
        Value::Array(_) => "array",
        Value::Object(_) => "object",
        Value::Map(_) => "map",
        Value::Function(_) => "function",
        Value::NoValue => "novalue",
    };

    Ok(Value::String(type_name.to_string()))
}

/// Get the kind of a value
pub fn kind_of(args: &[Value]) -> Result<Value, FuncError> {
    type_of(args)
}

/// Check if value is of a specific type
pub fn type_is(args: &[Value]) -> Result<Value, FuncError> {
    let type_name = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let value = args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    let type_name = type_name.to_string();
    let actual_type = match value {
        Value::Nil => "nil",
        Value::Bool(_) => "bool",
        Value::Number(_) => "number",
        Value::String(_) => "string",
        Value::Array(_) => "array",
        Value::Object(_) => "object",
        Value::Map(_) => "map",
        Value::Function(_) => "function",
        Value::NoValue => "novalue",
    };

    Ok(Value::Bool(type_name == actual_type))
}

/// Check if value is of a specific kind
pub fn kind_is(args: &[Value]) -> Result<Value, FuncError> {
    type_is(args)
}

/// Check deep equality
pub fn deep_equal(args: &[Value]) -> Result<Value, FuncError> {
    let val1 = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let val2 = args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    Ok(Value::Bool(val1 == val2))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_atoi() {
        let result = atoi(&[Value::String("42".to_string())]).unwrap();
        assert_eq!(result.to_string(), "42");
    }

    #[test]
    fn test_to_string() {
        let result = to_string(&[Value::Number(42.into())]).unwrap();
        assert_eq!(result.to_string(), "42");
    }

    #[test]
    fn test_type_of() {
        let result = type_of(&[Value::String("hello".to_string())]).unwrap();
        assert_eq!(result.to_string(), "string");

        let result = type_of(&[Value::Number(42.into())]).unwrap();
        assert_eq!(result.to_string(), "number");

        let result = type_of(&[Value::Array(vec![])]).unwrap();
        assert_eq!(result.to_string(), "array");
    }

    #[test]
    fn test_type_is() {
        let result = type_is(&[
            Value::String("string".to_string()),
            Value::String("hello".to_string()),
        ])
        .unwrap();
        assert_eq!(result, Value::Bool(true));

        let result = type_is(&[
            Value::String("number".to_string()),
            Value::String("hello".to_string()),
        ])
        .unwrap();
        assert_eq!(result, Value::Bool(false));
    }

    #[test]
    fn test_deep_equal() {
        let result = deep_equal(&[
            Value::String("test".to_string()),
            Value::String("test".to_string()),
        ])
        .unwrap();
        assert_eq!(result, Value::Bool(true));

        let result = deep_equal(&[
            Value::String("test".to_string()),
            Value::String("other".to_string()),
        ])
        .unwrap();
        assert_eq!(result, Value::Bool(false));
    }
}
