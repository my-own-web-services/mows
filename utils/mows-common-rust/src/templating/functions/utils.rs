use gtmpl::{FuncError, Value};
use std::collections::HashMap;

use super::conversion::{
    gtmpl_value_to_serde_json_value, gtmpl_value_to_serde_yaml_value,
    serde_json_value_to_gtmpl_value, serde_yaml_value_to_gtmpl_value,
};

pub fn dict(args: &[Value]) -> Result<Value, FuncError> {
    let mut dict = HashMap::new();
    let mut args = args.iter();
    while let Some(key) = args.next() {
        let value = args
            .next()
            .ok_or(FuncError::Generic("No value found".to_string()))?;
        dict.insert(key.to_string(), value.clone());
    }
    Ok(Value::from(dict))
}

pub fn list(args: &[Value]) -> Result<Value, FuncError> {
    Ok(Value::Array(args.to_vec()))
}

/// Join a domain and a subdomain together, joindomain "example.com" "www" -> "www.example.com"
pub fn join_domain(args: &[Value]) -> Result<Value, FuncError> {
    let domain = args.first().ok_or(FuncError::AtLeastXArgs(
        "This function requires at least 1 argument.".to_string(),
        1,
    ))?;
    let maybe_subdomain = args.get(1).unwrap_or(&Value::Nil);

    if maybe_subdomain.to_string().is_empty() || maybe_subdomain == &Value::Nil {
        Ok(domain.clone())
    } else {
        Ok(Value::String(format!("{maybe_subdomain}.{domain}")))
    }
}

pub fn from_yaml(args: &[Value]) -> Result<Value, FuncError> {
    let value = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    let value = value.to_string();
    let value: serde_yaml::Value =
        serde_yaml::from_str(&value).map_err(|e| FuncError::Generic(e.to_string()))?;
    let value = serde_yaml_value_to_gtmpl_value(value);
    Ok(Value::from(value))
}

pub fn to_yaml(args: &[Value]) -> Result<Value, FuncError> {
    let value = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    let yaml =
        serde_yaml::to_string(&gtmpl_value_to_serde_yaml_value(value).map_err(|e| {
            FuncError::Generic(format!("Error converting to yaml: {}", e.to_string()))
        })?)
        .map_err(|e| FuncError::Generic(e.to_string()))?;

    Ok(Value::String(yaml))
}

pub fn from_json(args: &[Value]) -> Result<Value, FuncError> {
    let value = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    let value = value.to_string();
    let value: serde_json::Value =
        serde_json::from_str(&value).map_err(|e| FuncError::Generic(e.to_string()))?;
    let value = serde_json_value_to_gtmpl_value(value);
    Ok(Value::from(value))
}

pub fn to_json(args: &[Value]) -> Result<Value, FuncError> {
    let value = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    let json =
        serde_json::to_string(&gtmpl_value_to_serde_json_value(value).map_err(|e| {
            FuncError::Generic(format!("Error converting to json: {}", e.to_string()))
        })?)
        .map_err(|e| FuncError::Generic(e.to_string()))?;

    Ok(Value::String(json))
}

pub fn to_pretty_json(args: &[Value]) -> Result<Value, FuncError> {
    let value = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    let json =
        serde_json::to_string_pretty(&gtmpl_value_to_serde_json_value(value).map_err(|e| {
            FuncError::Generic(format!("Error converting to json: {}", e.to_string()))
        })?)
        .map_err(|e| FuncError::Generic(e.to_string()))?;

    Ok(Value::String(json))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_dict() {
        let result = dict(&[
            Value::String("key1".to_string()),
            Value::String("value1".to_string()),
            Value::String("key2".to_string()),
            Value::Number(42.into()),
        ])
        .unwrap();

        if let Value::Map(m) = result {
            assert_eq!(m.len(), 2);
            assert_eq!(m.get("key1").unwrap().to_string(), "value1");
            assert_eq!(m.get("key2").unwrap().to_string(), "42");
        } else {
            panic!("Expected map");
        }
    }

    #[test]
    fn test_list() {
        let result = list(&[
            Value::Number(1.into()),
            Value::Number(2.into()),
            Value::Number(3.into()),
        ])
        .unwrap();

        if let Value::Array(arr) = result {
            assert_eq!(arr.len(), 3);
            assert_eq!(arr[0].to_string(), "1");
        } else {
            panic!("Expected array");
        }
    }

    #[test]
    fn test_join_domain() {
        let result = join_domain(&[
            Value::String("example.com".to_string()),
            Value::String("www".to_string()),
        ])
        .unwrap();
        assert_eq!(result.to_string(), "www.example.com");
    }

    #[test]
    fn test_join_domain_no_subdomain() {
        let result = join_domain(&[
            Value::String("example.com".to_string()),
            Value::Nil,
        ])
        .unwrap();
        assert_eq!(result.to_string(), "example.com");
    }

    #[test]
    fn test_to_json_from_json() {
        let mut map = HashMap::new();
        map.insert("foo".to_string(), Value::String("bar".to_string()));
        let dict = Value::Map(map);

        let json_str = to_json(&[dict]).unwrap();
        let parsed = from_json(&[json_str]).unwrap();

        if let Value::Object(obj) = parsed {
            assert_eq!(obj.get("foo").unwrap().to_string(), "bar");
        } else {
            panic!("Expected object");
        }
    }

    #[test]
    fn test_to_yaml_from_yaml() {
        let mut map = HashMap::new();
        map.insert("foo".to_string(), Value::String("bar".to_string()));
        let dict = Value::Map(map);

        let yaml_str = to_yaml(&[dict]).unwrap();
        let parsed = from_yaml(&[yaml_str]).unwrap();

        if let Value::Object(obj) = parsed {
            assert_eq!(obj.get("foo").unwrap().to_string(), "bar");
        } else {
            panic!("Expected object");
        }
    }
}
