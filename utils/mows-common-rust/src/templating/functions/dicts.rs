use gtmpl::{FuncError, Value};
use std::collections::HashMap;

/// Get value from dictionary by key
pub fn get(args: &[Value]) -> Result<Value, FuncError> {
    let dict = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let key = args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    let key_str = key.to_string();

    match dict {
        Value::Map(m) => Ok(m.get(&key_str).cloned().unwrap_or(Value::Nil)),
        Value::Object(o) => Ok(o.get(&key_str).cloned().unwrap_or(Value::Nil)),
        _ => Err(FuncError::Generic(
            "First argument must be a dictionary".to_string(),
        )),
    }
}

/// Set value in dictionary
pub fn set(args: &[Value]) -> Result<Value, FuncError> {
    let dict = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;
    let key = args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;
    let value = args.get(2).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;

    let key_str = key.to_string();

    match dict {
        Value::Map(m) => {
            let mut new_map = m.clone();
            new_map.insert(key_str, value.clone());
            Ok(Value::Map(new_map))
        }
        Value::Object(o) => {
            let mut new_obj = o.clone();
            new_obj.insert(key_str, value.clone());
            Ok(Value::Object(new_obj))
        }
        _ => Err(FuncError::Generic(
            "First argument must be a dictionary".to_string(),
        )),
    }
}

/// Remove key from dictionary
pub fn unset(args: &[Value]) -> Result<Value, FuncError> {
    let dict = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let key = args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    let key_str = key.to_string();

    match dict {
        Value::Map(m) => {
            let mut new_map = m.clone();
            new_map.remove(&key_str);
            Ok(Value::Map(new_map))
        }
        Value::Object(o) => {
            let mut new_obj = o.clone();
            new_obj.remove(&key_str);
            Ok(Value::Object(new_obj))
        }
        _ => Err(FuncError::Generic(
            "First argument must be a dictionary".to_string(),
        )),
    }
}

/// Check if dictionary has key
pub fn has_key(args: &[Value]) -> Result<Value, FuncError> {
    let dict = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let key = args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    let key_str = key.to_string();

    let has_key = match dict {
        Value::Map(m) => m.contains_key(&key_str),
        Value::Object(o) => o.contains_key(&key_str),
        _ => {
            return Err(FuncError::Generic(
                "First argument must be a dictionary".to_string(),
            ))
        }
    };

    Ok(Value::Bool(has_key))
}

/// Get all keys from dictionary
pub fn keys(args: &[Value]) -> Result<Value, FuncError> {
    let dict = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    let keys_vec = match dict {
        Value::Map(m) => m.keys().map(|k| Value::String(k.clone())).collect(),
        Value::Object(o) => o.keys().map(|k| Value::String(k.clone())).collect(),
        _ => {
            return Err(FuncError::Generic(
                "Argument must be a dictionary".to_string(),
            ))
        }
    };

    Ok(Value::Array(keys_vec))
}

/// Get all values from dictionary
pub fn values(args: &[Value]) -> Result<Value, FuncError> {
    let dict = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    let values_vec = match dict {
        Value::Map(m) => m.values().cloned().collect(),
        Value::Object(o) => o.values().cloned().collect(),
        _ => {
            return Err(FuncError::Generic(
                "Argument must be a dictionary".to_string(),
            ))
        }
    };

    Ok(Value::Array(values_vec))
}

/// Pick specific keys from dictionary
pub fn pick(args: &[Value]) -> Result<Value, FuncError> {
    let dict = args.first().ok_or(FuncError::AtLeastXArgs(
        "This function requires at least 2 arguments.".to_string(),
        2,
    ))?;

    let keys_to_pick: Vec<String> = args[1..].iter().map(|v| v.to_string()).collect();

    match dict {
        Value::Map(m) => {
            let mut new_map = HashMap::new();
            for key in keys_to_pick {
                if let Some(value) = m.get(&key) {
                    new_map.insert(key, value.clone());
                }
            }
            Ok(Value::Map(new_map))
        }
        Value::Object(o) => {
            let mut new_obj = HashMap::new();
            for key in keys_to_pick {
                if let Some(value) = o.get(&key) {
                    new_obj.insert(key, value.clone());
                }
            }
            Ok(Value::Object(new_obj))
        }
        _ => Err(FuncError::Generic(
            "First argument must be a dictionary".to_string(),
        )),
    }
}

/// Omit specific keys from dictionary
pub fn omit(args: &[Value]) -> Result<Value, FuncError> {
    let dict = args.first().ok_or(FuncError::AtLeastXArgs(
        "This function requires at least 2 arguments.".to_string(),
        2,
    ))?;

    let keys_to_omit: Vec<String> = args[1..].iter().map(|v| v.to_string()).collect();

    match dict {
        Value::Map(m) => {
            let mut new_map = m.clone();
            for key in keys_to_omit {
                new_map.remove(&key);
            }
            Ok(Value::Map(new_map))
        }
        Value::Object(o) => {
            let mut new_obj = o.clone();
            for key in keys_to_omit {
                new_obj.remove(&key);
            }
            Ok(Value::Object(new_obj))
        }
        _ => Err(FuncError::Generic(
            "First argument must be a dictionary".to_string(),
        )),
    }
}

/// Merge dictionaries
pub fn merge(args: &[Value]) -> Result<Value, FuncError> {
    if args.is_empty() {
        return Ok(Value::Map(HashMap::new()));
    }

    let mut result = HashMap::new();

    for arg in args {
        match arg {
            Value::Map(m) => {
                for (k, v) in m {
                    result.insert(k.clone(), v.clone());
                }
            }
            Value::Object(o) => {
                for (k, v) in o {
                    result.insert(k.clone(), v.clone());
                }
            }
            _ => {
                return Err(FuncError::Generic(
                    "All arguments must be dictionaries".to_string(),
                ))
            }
        }
    }

    Ok(Value::Map(result))
}

/// Merge dictionaries (must version)
pub fn must_merge(args: &[Value]) -> Result<Value, FuncError> {
    merge(args)
}

/// Merge dictionaries with overwrite
pub fn merge_overwrite(args: &[Value]) -> Result<Value, FuncError> {
    merge(args)
}

/// Merge dictionaries with overwrite (must version)
pub fn must_merge_overwrite(args: &[Value]) -> Result<Value, FuncError> {
    merge(args)
}

/// Deep copy a value
pub fn deep_copy(args: &[Value]) -> Result<Value, FuncError> {
    let value = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    Ok(value.clone())
}

/// Deep copy a value (must version)
pub fn must_deep_copy(args: &[Value]) -> Result<Value, FuncError> {
    deep_copy(args)
}

/// Pluck values from a list of dictionaries
pub fn pluck(args: &[Value]) -> Result<Value, FuncError> {
    let key = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let list = args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    let key_str = key.to_string();

    match list {
        Value::Array(arr) => {
            let mut result = Vec::new();
            for item in arr {
                match item {
                    Value::Map(m) => {
                        if let Some(value) = m.get(&key_str) {
                            result.push(value.clone());
                        }
                    }
                    Value::Object(o) => {
                        if let Some(value) = o.get(&key_str) {
                            result.push(value.clone());
                        }
                    }
                    _ => {}
                }
            }
            Ok(Value::Array(result))
        }
        _ => Err(FuncError::Generic(
            "Second argument must be an array".to_string(),
        )),
    }
}

/// Dig into nested structures
pub fn dig(args: &[Value]) -> Result<Value, FuncError> {
    if args.len() < 2 {
        return Err(FuncError::AtLeastXArgs(
            "This function requires at least 2 arguments.".to_string(),
            2,
        ));
    }

    let mut current = args[0].clone();

    for key in &args[1..] {
        let key_str = key.to_string();

        current = match &current {
            Value::Map(m) => m.get(&key_str).cloned().unwrap_or(Value::Nil),
            Value::Object(o) => o.get(&key_str).cloned().unwrap_or(Value::Nil),
            Value::Array(arr) => {
                if let Ok(idx) = key_str.parse::<usize>() {
                    arr.get(idx).cloned().unwrap_or(Value::Nil)
                } else {
                    Value::Nil
                }
            }
            _ => Value::Nil,
        };

        if matches!(current, Value::Nil) {
            break;
        }
    }

    Ok(current)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get() {
        let mut map = HashMap::new();
        map.insert("foo".to_string(), Value::String("bar".to_string()));
        let dict = Value::Map(map);

        let result = get(&[dict, Value::String("foo".to_string())]).unwrap();
        assert_eq!(result.to_string(), "bar");
    }

    #[test]
    fn test_set() {
        let mut map = HashMap::new();
        map.insert("foo".to_string(), Value::String("bar".to_string()));
        let dict = Value::Map(map);

        let result = set(&[
            dict,
            Value::String("baz".to_string()),
            Value::String("qux".to_string()),
        ])
        .unwrap();

        if let Value::Map(m) = result {
            assert_eq!(m.get("baz").unwrap().to_string(), "qux");
        } else {
            panic!("Expected map");
        }
    }

    #[test]
    fn test_has_key() {
        let mut map = HashMap::new();
        map.insert("foo".to_string(), Value::String("bar".to_string()));
        let dict = Value::Map(map);

        let result = has_key(&[dict, Value::String("foo".to_string())]).unwrap();
        assert_eq!(result, Value::Bool(true));
    }

    #[test]
    fn test_keys() {
        let mut map = HashMap::new();
        map.insert("a".to_string(), Value::Number(1.into()));
        map.insert("b".to_string(), Value::Number(2.into()));
        let dict = Value::Map(map);

        let result = keys(&[dict]).unwrap();
        if let Value::Array(arr) = result {
            assert_eq!(arr.len(), 2);
        } else {
            panic!("Expected array");
        }
    }

    #[test]
    fn test_values() {
        let mut map = HashMap::new();
        map.insert("a".to_string(), Value::Number(1.into()));
        map.insert("b".to_string(), Value::Number(2.into()));
        let dict = Value::Map(map);

        let result = values(&[dict]).unwrap();
        if let Value::Array(arr) = result {
            assert_eq!(arr.len(), 2);
        } else {
            panic!("Expected array");
        }
    }

    #[test]
    fn test_merge() {
        let mut map1 = HashMap::new();
        map1.insert("a".to_string(), Value::Number(1.into()));
        let dict1 = Value::Map(map1);

        let mut map2 = HashMap::new();
        map2.insert("b".to_string(), Value::Number(2.into()));
        let dict2 = Value::Map(map2);

        let result = merge(&[dict1, dict2]).unwrap();
        if let Value::Map(m) = result {
            assert_eq!(m.len(), 2);
            assert!(m.contains_key("a"));
            assert!(m.contains_key("b"));
        } else {
            panic!("Expected map");
        }
    }

    #[test]
    fn test_unset() {
        let mut map = HashMap::new();
        map.insert("a".to_string(), Value::Number(1.into()));
        map.insert("b".to_string(), Value::Number(2.into()));
        let dict = Value::Map(map);

        let result = unset(&[dict, Value::String("a".to_string())]).unwrap();
        if let Value::Map(m) = result {
            assert_eq!(m.len(), 1);
            assert!(!m.contains_key("a"));
            assert!(m.contains_key("b"));
        } else {
            panic!("Expected map");
        }
    }

    #[test]
    fn test_pick() {
        let mut map = HashMap::new();
        map.insert("a".to_string(), Value::Number(1.into()));
        map.insert("b".to_string(), Value::Number(2.into()));
        map.insert("c".to_string(), Value::Number(3.into()));
        let dict = Value::Map(map);

        let result = pick(&[
            dict,
            Value::String("a".to_string()),
            Value::String("c".to_string()),
        ])
        .unwrap();
        if let Value::Map(m) = result {
            assert_eq!(m.len(), 2);
            assert!(m.contains_key("a"));
            assert!(m.contains_key("c"));
            assert!(!m.contains_key("b"));
        } else {
            panic!("Expected map");
        }
    }

    #[test]
    fn test_omit() {
        let mut map = HashMap::new();
        map.insert("a".to_string(), Value::Number(1.into()));
        map.insert("b".to_string(), Value::Number(2.into()));
        map.insert("c".to_string(), Value::Number(3.into()));
        let dict = Value::Map(map);

        let result = omit(&[dict, Value::String("b".to_string())]).unwrap();
        if let Value::Map(m) = result {
            assert_eq!(m.len(), 2);
            assert!(m.contains_key("a"));
            assert!(m.contains_key("c"));
            assert!(!m.contains_key("b"));
        } else {
            panic!("Expected map");
        }
    }

    #[test]
    fn test_deep_copy() {
        let mut map = HashMap::new();
        map.insert("a".to_string(), Value::Number(1.into()));
        let dict = Value::Map(map);

        let result = deep_copy(&[dict.clone()]).unwrap();
        assert_eq!(result, dict);
    }

    #[test]
    fn test_pluck() {
        let mut map1 = HashMap::new();
        map1.insert("name".to_string(), Value::String("Alice".to_string()));
        map1.insert("age".to_string(), Value::Number(30.into()));

        let mut map2 = HashMap::new();
        map2.insert("name".to_string(), Value::String("Bob".to_string()));
        map2.insert("age".to_string(), Value::Number(25.into()));

        let list = Value::Array(vec![Value::Map(map1), Value::Map(map2)]);

        let result = pluck(&[Value::String("name".to_string()), list]).unwrap();
        if let Value::Array(arr) = result {
            assert_eq!(arr.len(), 2);
            assert_eq!(arr[0].to_string(), "Alice");
            assert_eq!(arr[1].to_string(), "Bob");
        } else {
            panic!("Expected array");
        }
    }

    #[test]
    fn test_dig() {
        let mut inner_map = HashMap::new();
        inner_map.insert("c".to_string(), Value::String("value".to_string()));

        let mut map = HashMap::new();
        map.insert("a".to_string(), Value::Map(inner_map));
        let dict = Value::Map(map);

        let result = dig(&[
            dict,
            Value::String("a".to_string()),
            Value::String("c".to_string()),
        ])
        .unwrap();
        assert_eq!(result.to_string(), "value");
    }
}
