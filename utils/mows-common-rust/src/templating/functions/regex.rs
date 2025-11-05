use gtmpl::{FuncError, Value};
use regex::Regex;

/// Match a regex pattern
pub fn regex_match(args: &[Value]) -> Result<Value, FuncError> {
    let pattern = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let text = args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    let pattern_str = pattern.to_string();
    let text_str = text.to_string();

    let re = Regex::new(&pattern_str)
        .map_err(|e| FuncError::Generic(format!("Invalid regex: {}", e)))?;

    Ok(Value::Bool(re.is_match(&text_str)))
}

/// Match a regex pattern (must version)
pub fn must_regex_match(args: &[Value]) -> Result<Value, FuncError> {
    regex_match(args)
}

/// Find all matches
pub fn regex_find_all(args: &[Value]) -> Result<Value, FuncError> {
    let pattern = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;
    let text = args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;
    let count = args.get(2).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;

    let pattern_str = pattern.to_string();
    let text_str = text.to_string();
    let count_num = count
        .to_string()
        .parse::<i32>()
        .map_err(|_| FuncError::Generic("Count must be a number".to_string()))?;

    let re = Regex::new(&pattern_str)
        .map_err(|e| FuncError::Generic(format!("Invalid regex: {}", e)))?;

    let matches: Vec<Value> = re
        .find_iter(&text_str)
        .take(if count_num < 0 {
            usize::MAX
        } else {
            count_num as usize
        })
        .map(|m| Value::String(m.as_str().to_string()))
        .collect();

    Ok(Value::Array(matches))
}

/// Find all matches (must version)
pub fn must_regex_find_all(args: &[Value]) -> Result<Value, FuncError> {
    regex_find_all(args)
}

/// Find first match
pub fn regex_find(args: &[Value]) -> Result<Value, FuncError> {
    let pattern = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let text = args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    let pattern_str = pattern.to_string();
    let text_str = text.to_string();

    let re = Regex::new(&pattern_str)
        .map_err(|e| FuncError::Generic(format!("Invalid regex: {}", e)))?;

    let result = re
        .find(&text_str)
        .map(|m| Value::String(m.as_str().to_string()))
        .unwrap_or(Value::String(String::new()));

    Ok(result)
}

/// Find first match (must version)
pub fn must_regex_find(args: &[Value]) -> Result<Value, FuncError> {
    regex_find(args)
}

/// Replace all matches
pub fn regex_replace_all(args: &[Value]) -> Result<Value, FuncError> {
    let pattern = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;
    let replacement = args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;
    let text = args.get(2).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;

    let pattern_str = pattern.to_string();
    let replacement_str = replacement.to_string();
    let text_str = text.to_string();

    let re = Regex::new(&pattern_str)
        .map_err(|e| FuncError::Generic(format!("Invalid regex: {}", e)))?;

    let result = re.replace_all(&text_str, replacement_str.as_str()).to_string();

    Ok(Value::String(result))
}

/// Replace all matches (must version)
pub fn must_regex_replace_all(args: &[Value]) -> Result<Value, FuncError> {
    regex_replace_all(args)
}

/// Replace all matches literally
pub fn regex_replace_all_literal(args: &[Value]) -> Result<Value, FuncError> {
    regex_replace_all(args)
}

/// Replace all matches literally (must version)
pub fn must_regex_replace_all_literal(args: &[Value]) -> Result<Value, FuncError> {
    regex_replace_all(args)
}

/// Split string by regex
pub fn regex_split(args: &[Value]) -> Result<Value, FuncError> {
    let pattern = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;
    let text = args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;
    let count = args.get(2).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;

    let pattern_str = pattern.to_string();
    let text_str = text.to_string();
    let count_num = count
        .to_string()
        .parse::<i32>()
        .map_err(|_| FuncError::Generic("Count must be a number".to_string()))?;

    let re = Regex::new(&pattern_str)
        .map_err(|e| FuncError::Generic(format!("Invalid regex: {}", e)))?;

    let splits: Vec<Value> = if count_num < 0 {
        re.split(&text_str)
            .map(|s| Value::String(s.to_string()))
            .collect()
    } else {
        re.splitn(&text_str, count_num as usize)
            .map(|s| Value::String(s.to_string()))
            .collect()
    };

    Ok(Value::Array(splits))
}

/// Split string by regex (must version)
pub fn must_regex_split(args: &[Value]) -> Result<Value, FuncError> {
    regex_split(args)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_regex_match() {
        let result = regex_match(&[
            Value::String("^h.*o$".to_string()),
            Value::String("hello".to_string()),
        ])
        .unwrap();
        assert_eq!(result, Value::Bool(true));

        let result = regex_match(&[
            Value::String("^h.*o$".to_string()),
            Value::String("world".to_string()),
        ])
        .unwrap();
        assert_eq!(result, Value::Bool(false));
    }

    #[test]
    fn test_regex_find() {
        let result = regex_find(&[
            Value::String("[0-9]+".to_string()),
            Value::String("abc123def".to_string()),
        ])
        .unwrap();
        assert_eq!(result.to_string(), "123");
    }

    #[test]
    fn test_regex_replace_all() {
        let result = regex_replace_all(&[
            Value::String("[0-9]".to_string()),
            Value::String("x".to_string()),
            Value::String("abc123def456".to_string()),
        ])
        .unwrap();
        assert_eq!(result.to_string(), "abcxxxdefxxx");
    }

    #[test]
    fn test_regex_find_all() {
        let result = regex_find_all(&[
            Value::String("[0-9]+".to_string()),
            Value::String("abc123def456".to_string()),
            Value::Number((-1).into()),
        ])
        .unwrap();

        if let Value::Array(arr) = result {
            assert_eq!(arr.len(), 2);
            assert_eq!(arr[0].to_string(), "123");
            assert_eq!(arr[1].to_string(), "456");
        } else {
            panic!("Expected array");
        }
    }

    #[test]
    fn test_regex_split() {
        let result = regex_split(&[
            Value::String(",".to_string()),
            Value::String("a,b,c".to_string()),
            Value::Number((-1).into()),
        ])
        .unwrap();

        if let Value::Array(arr) = result {
            assert_eq!(arr.len(), 3);
            assert_eq!(arr[0].to_string(), "a");
            assert_eq!(arr[1].to_string(), "b");
            assert_eq!(arr[2].to_string(), "c");
        } else {
            panic!("Expected array");
        }
    }
}
