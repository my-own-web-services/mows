use gtmpl::{FuncError, Value};
use std::collections::HashSet;

/// Get the first element of a list
pub fn first(args: &[Value]) -> Result<Value, FuncError> {
    let list = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    match list {
        Value::Array(arr) => arr
            .first()
            .cloned()
            .ok_or(FuncError::Generic("Array is empty".to_string())),
        _ => Err(FuncError::Generic("Argument must be an array".to_string())),
    }
}

/// Get the first element of a list (must version)
pub fn must_first(args: &[Value]) -> Result<Value, FuncError> {
    first(args)
}

/// Get all elements except the first
pub fn rest(args: &[Value]) -> Result<Value, FuncError> {
    let list = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    match list {
        Value::Array(arr) => {
            if arr.is_empty() {
                Ok(Value::Array(vec![]))
            } else {
                Ok(Value::Array(arr[1..].to_vec()))
            }
        }
        _ => Err(FuncError::Generic("Argument must be an array".to_string())),
    }
}

/// Get all elements except the first (must version)
pub fn must_rest(args: &[Value]) -> Result<Value, FuncError> {
    rest(args)
}

/// Get the last element of a list
pub fn last(args: &[Value]) -> Result<Value, FuncError> {
    let list = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    match list {
        Value::Array(arr) => arr
            .last()
            .cloned()
            .ok_or(FuncError::Generic("Array is empty".to_string())),
        _ => Err(FuncError::Generic("Argument must be an array".to_string())),
    }
}

/// Get the last element of a list (must version)
pub fn must_last(args: &[Value]) -> Result<Value, FuncError> {
    last(args)
}

/// Get all elements except the last
pub fn initial(args: &[Value]) -> Result<Value, FuncError> {
    let list = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    match list {
        Value::Array(arr) => {
            if arr.is_empty() {
                Ok(Value::Array(vec![]))
            } else {
                Ok(Value::Array(arr[..arr.len() - 1].to_vec()))
            }
        }
        _ => Err(FuncError::Generic("Argument must be an array".to_string())),
    }
}

/// Get all elements except the last (must version)
pub fn must_initial(args: &[Value]) -> Result<Value, FuncError> {
    initial(args)
}

/// Append element to list
pub fn append(args: &[Value]) -> Result<Value, FuncError> {
    let list = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let element = args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    match list {
        Value::Array(arr) => {
            let mut new_arr = arr.clone();
            new_arr.push(element.clone());
            Ok(Value::Array(new_arr))
        }
        _ => Err(FuncError::Generic("First argument must be an array".to_string())),
    }
}

/// Append element to list (must version)
pub fn must_append(args: &[Value]) -> Result<Value, FuncError> {
    append(args)
}

/// Prepend element to list
pub fn prepend(args: &[Value]) -> Result<Value, FuncError> {
    let list = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let element = args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    match list {
        Value::Array(arr) => {
            let mut new_arr = vec![element.clone()];
            new_arr.extend(arr.clone());
            Ok(Value::Array(new_arr))
        }
        _ => Err(FuncError::Generic("First argument must be an array".to_string())),
    }
}

/// Prepend element to list (must version)
pub fn must_prepend(args: &[Value]) -> Result<Value, FuncError> {
    prepend(args)
}

/// Concatenate multiple lists
pub fn concat(args: &[Value]) -> Result<Value, FuncError> {
    let mut result = Vec::new();

    for arg in args {
        match arg {
            Value::Array(arr) => result.extend(arr.clone()),
            _ => return Err(FuncError::Generic("All arguments must be arrays".to_string())),
        }
    }

    Ok(Value::Array(result))
}

/// Reverse a list
pub fn reverse(args: &[Value]) -> Result<Value, FuncError> {
    let list = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    match list {
        Value::Array(arr) => {
            let mut reversed = arr.clone();
            reversed.reverse();
            Ok(Value::Array(reversed))
        }
        _ => Err(FuncError::Generic("Argument must be an array".to_string())),
    }
}

/// Reverse a list (must version)
pub fn must_reverse(args: &[Value]) -> Result<Value, FuncError> {
    reverse(args)
}

/// Get unique elements from a list
pub fn uniq(args: &[Value]) -> Result<Value, FuncError> {
    let list = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    match list {
        Value::Array(arr) => {
            let mut seen = HashSet::new();
            let mut result = Vec::new();

            for item in arr {
                let key = format!("{:?}", item);
                if seen.insert(key) {
                    result.push(item.clone());
                }
            }

            Ok(Value::Array(result))
        }
        _ => Err(FuncError::Generic("Argument must be an array".to_string())),
    }
}

/// Get unique elements from a list (must version)
pub fn must_uniq(args: &[Value]) -> Result<Value, FuncError> {
    uniq(args)
}

/// Remove elements from list
pub fn without(args: &[Value]) -> Result<Value, FuncError> {
    let list = args.first().ok_or(FuncError::AtLeastXArgs(
        "This function requires at least 2 arguments.".to_string(),
        2,
    ))?;

    match list {
        Value::Array(arr) => {
            let to_remove: Vec<String> = args[1..].iter().map(|v| format!("{:?}", v)).collect();
            let result: Vec<Value> = arr
                .iter()
                .filter(|item| !to_remove.contains(&format!("{:?}", item)))
                .cloned()
                .collect();
            Ok(Value::Array(result))
        }
        _ => Err(FuncError::Generic("First argument must be an array".to_string())),
    }
}

/// Remove elements from list (must version)
pub fn must_without(args: &[Value]) -> Result<Value, FuncError> {
    without(args)
}

/// Check if list contains element
pub fn has(args: &[Value]) -> Result<Value, FuncError> {
    let list = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let element = args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    match list {
        Value::Array(arr) => {
            let element_key = format!("{:?}", element);
            let found = arr.iter().any(|item| format!("{:?}", item) == element_key);
            Ok(Value::Bool(found))
        }
        _ => Err(FuncError::Generic("First argument must be an array".to_string())),
    }
}

/// Check if list contains element (must version)
pub fn must_has(args: &[Value]) -> Result<Value, FuncError> {
    has(args)
}

/// Remove nil/empty values from list
pub fn compact(args: &[Value]) -> Result<Value, FuncError> {
    let list = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    match list {
        Value::Array(arr) => {
            let result: Vec<Value> = arr
                .iter()
                .filter(|item| !matches!(item, Value::Nil | Value::NoValue))
                .cloned()
                .collect();
            Ok(Value::Array(result))
        }
        _ => Err(FuncError::Generic("Argument must be an array".to_string())),
    }
}

/// Remove nil/empty values from list (must version)
pub fn must_compact(args: &[Value]) -> Result<Value, FuncError> {
    compact(args)
}

/// Get element at index
pub fn index_list(args: &[Value]) -> Result<Value, FuncError> {
    let list = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let idx = args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    let idx = idx
        .to_string()
        .parse::<usize>()
        .map_err(|_| FuncError::Generic("Index must be a number".to_string()))?;

    match list {
        Value::Array(arr) => arr
            .get(idx)
            .cloned()
            .ok_or(FuncError::Generic("Index out of bounds".to_string())),
        _ => Err(FuncError::Generic("First argument must be an array".to_string())),
    }
}

/// Slice a list
pub fn slice(args: &[Value]) -> Result<Value, FuncError> {
    let list = args.first().ok_or(FuncError::AtLeastXArgs(
        "This function requires at least 2 arguments.".to_string(),
        2,
    ))?;
    let start = args.get(1).ok_or(FuncError::AtLeastXArgs(
        "This function requires at least 2 arguments.".to_string(),
        2,
    ))?;

    let start = start
        .to_string()
        .parse::<usize>()
        .map_err(|_| FuncError::Generic("Start index must be a number".to_string()))?;

    let end = if let Some(end_val) = args.get(2) {
        Some(
            end_val
                .to_string()
                .parse::<usize>()
                .map_err(|_| FuncError::Generic("End index must be a number".to_string()))?,
        )
    } else {
        None
    };

    match list {
        Value::Array(arr) => {
            let end = end.unwrap_or(arr.len());
            if start > arr.len() || end > arr.len() || start > end {
                return Err(FuncError::Generic("Invalid slice range".to_string()));
            }
            Ok(Value::Array(arr[start..end].to_vec()))
        }
        _ => Err(FuncError::Generic("First argument must be an array".to_string())),
    }
}

/// Slice a list (must version)
pub fn must_slice(args: &[Value]) -> Result<Value, FuncError> {
    slice(args)
}

/// Generate a list of numbers from 0 to n-1
pub fn until(args: &[Value]) -> Result<Value, FuncError> {
    let count = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    let count = count
        .to_string()
        .parse::<i64>()
        .map_err(|_| FuncError::Generic("Argument must be a number".to_string()))?;

    let result: Vec<Value> = (0..count).map(|i| Value::Number(i.into())).collect();
    Ok(Value::Array(result))
}

/// Generate a list of numbers with step
pub fn until_step(args: &[Value]) -> Result<Value, FuncError> {
    let start = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;
    let step = args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;
    let end = args.get(2).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;

    let start = start
        .to_string()
        .parse::<i64>()
        .map_err(|_| FuncError::Generic("Start must be a number".to_string()))?;
    let step = step
        .to_string()
        .parse::<i64>()
        .map_err(|_| FuncError::Generic("Step must be a number".to_string()))?;
    let end = end
        .to_string()
        .parse::<i64>()
        .map_err(|_| FuncError::Generic("End must be a number".to_string()))?;

    if step == 0 {
        return Err(FuncError::Generic("Step cannot be zero".to_string()));
    }

    let mut result = Vec::new();
    if step > 0 {
        let mut i = start;
        while i < end {
            result.push(Value::Number(i.into()));
            i += step;
        }
    } else {
        let mut i = start;
        while i > end {
            result.push(Value::Number(i.into()));
            i += step;
        }
    }

    Ok(Value::Array(result))
}

/// Generate a sequence of numbers
pub fn seq(args: &[Value]) -> Result<Value, FuncError> {
    let start = args.first().ok_or(FuncError::AtLeastXArgs(
        "This function requires at least 1 argument.".to_string(),
        1,
    ))?;

    let start = start
        .to_string()
        .parse::<i64>()
        .map_err(|_| FuncError::Generic("Start must be a number".to_string()))?;

    let end = if let Some(end_val) = args.get(1) {
        end_val
            .to_string()
            .parse::<i64>()
            .map_err(|_| FuncError::Generic("End must be a number".to_string()))?
    } else {
        start
    };

    let result: Vec<Value> = if args.len() == 1 {
        (1..=start).map(|i| Value::Number(i.into())).collect()
    } else {
        (start..=end).map(|i| Value::Number(i.into())).collect()
    };

    Ok(Value::Array(result))
}

/// Get the length of a list or string
pub fn len_fn(args: &[Value]) -> Result<Value, FuncError> {
    let value = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    let length = match value {
        Value::Array(arr) => arr.len(),
        Value::String(s) => s.len(),
        Value::Map(m) => m.len(),
        Value::Object(o) => o.len(),
        _ => return Err(FuncError::Generic("Argument must be an array, string, or map".to_string())),
    };

    Ok(Value::Number((length as i64).into()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_first() {
        let list = Value::Array(vec![
            Value::Number(1.into()),
            Value::Number(2.into()),
            Value::Number(3.into()),
        ]);
        let result = first(&[list]).unwrap();
        assert_eq!(result.to_string(), "1");
    }

    #[test]
    fn test_last() {
        let list = Value::Array(vec![
            Value::Number(1.into()),
            Value::Number(2.into()),
            Value::Number(3.into()),
        ]);
        let result = last(&[list]).unwrap();
        assert_eq!(result.to_string(), "3");
    }

    #[test]
    fn test_append() {
        let list = Value::Array(vec![Value::Number(1.into()), Value::Number(2.into())]);
        let result = append(&[list, Value::Number(3.into())]).unwrap();
        if let Value::Array(arr) = result {
            assert_eq!(arr.len(), 3);
            assert_eq!(arr[2].to_string(), "3");
        } else {
            panic!("Expected array");
        }
    }

    #[test]
    fn test_reverse() {
        let list = Value::Array(vec![
            Value::Number(1.into()),
            Value::Number(2.into()),
            Value::Number(3.into()),
        ]);
        let result = reverse(&[list]).unwrap();
        if let Value::Array(arr) = result {
            assert_eq!(arr[0].to_string(), "3");
            assert_eq!(arr[2].to_string(), "1");
        } else {
            panic!("Expected array");
        }
    }

    #[test]
    fn test_uniq() {
        let list = Value::Array(vec![
            Value::Number(1.into()),
            Value::Number(2.into()),
            Value::Number(2.into()),
            Value::Number(3.into()),
        ]);
        let result = uniq(&[list]).unwrap();
        if let Value::Array(arr) = result {
            assert_eq!(arr.len(), 3);
        } else {
            panic!("Expected array");
        }
    }

    #[test]
    fn test_until() {
        let result = until(&[Value::Number(5.into())]).unwrap();
        if let Value::Array(arr) = result {
            assert_eq!(arr.len(), 5);
            assert_eq!(arr[0].to_string(), "0");
            assert_eq!(arr[4].to_string(), "4");
        } else {
            panic!("Expected array");
        }
    }

    #[test]
    fn test_seq() {
        let result = seq(&[Value::Number(3.into())]).unwrap();
        if let Value::Array(arr) = result {
            assert_eq!(arr.len(), 3);
            assert_eq!(arr[0].to_string(), "1");
            assert_eq!(arr[2].to_string(), "3");
        } else {
            panic!("Expected array");
        }
    }

    #[test]
    fn test_len_fn() {
        let list = Value::Array(vec![
            Value::Number(1.into()),
            Value::Number(2.into()),
            Value::Number(3.into()),
            Value::Number(4.into()),
            Value::Number(5.into()),
        ]);
        let result = len_fn(&[list]).unwrap();
        assert_eq!(result.to_string(), "5");
    }

    #[test]
    fn test_concat() {
        let list1 = Value::Array(vec![Value::Number(1.into()), Value::Number(2.into())]);
        let list2 = Value::Array(vec![Value::Number(3.into()), Value::Number(4.into())]);
        let result = concat(&[list1, list2]).unwrap();
        if let Value::Array(arr) = result {
            assert_eq!(arr.len(), 4);
        } else {
            panic!("Expected array");
        }
    }

    #[test]
    fn test_rest() {
        let list = Value::Array(vec![
            Value::Number(1.into()),
            Value::Number(2.into()),
            Value::Number(3.into()),
        ]);
        let result = rest(&[list]).unwrap();
        if let Value::Array(arr) = result {
            assert_eq!(arr.len(), 2);
            assert_eq!(arr[0].to_string(), "2");
            assert_eq!(arr[1].to_string(), "3");
        } else {
            panic!("Expected array");
        }
    }

    #[test]
    fn test_initial() {
        let list = Value::Array(vec![
            Value::Number(1.into()),
            Value::Number(2.into()),
            Value::Number(3.into()),
        ]);
        let result = initial(&[list]).unwrap();
        if let Value::Array(arr) = result {
            assert_eq!(arr.len(), 2);
            assert_eq!(arr[0].to_string(), "1");
            assert_eq!(arr[1].to_string(), "2");
        } else {
            panic!("Expected array");
        }
    }

    #[test]
    fn test_prepend() {
        let list = Value::Array(vec![Value::Number(2.into()), Value::Number(3.into())]);
        let result = prepend(&[list, Value::Number(1.into())]).unwrap();
        if let Value::Array(arr) = result {
            assert_eq!(arr.len(), 3);
            assert_eq!(arr[0].to_string(), "1");
        } else {
            panic!("Expected array");
        }
    }

    #[test]
    fn test_without() {
        let list = Value::Array(vec![
            Value::Number(1.into()),
            Value::Number(2.into()),
            Value::Number(3.into()),
        ]);
        let result = without(&[list, Value::Number(2.into())]).unwrap();
        if let Value::Array(arr) = result {
            assert_eq!(arr.len(), 2);
        } else {
            panic!("Expected array");
        }
    }

    #[test]
    fn test_has() {
        let list = Value::Array(vec![
            Value::Number(1.into()),
            Value::Number(2.into()),
            Value::Number(3.into()),
        ]);
        let result = has(&[list.clone(), Value::Number(2.into())]).unwrap();
        assert_eq!(result, Value::Bool(true));

        let result = has(&[list, Value::Number(5.into())]).unwrap();
        assert_eq!(result, Value::Bool(false));
    }

    #[test]
    fn test_compact() {
        let list = Value::Array(vec![
            Value::Number(1.into()),
            Value::Nil,
            Value::Number(2.into()),
            Value::NoValue,
            Value::Number(3.into()),
        ]);
        let result = compact(&[list]).unwrap();
        if let Value::Array(arr) = result {
            assert_eq!(arr.len(), 3);
        } else {
            panic!("Expected array");
        }
    }

    #[test]
    fn test_index_list() {
        let list = Value::Array(vec![
            Value::String("a".to_string()),
            Value::String("b".to_string()),
            Value::String("c".to_string()),
        ]);
        let result = index_list(&[list, Value::Number(1.into())]).unwrap();
        assert_eq!(result.to_string(), "b");
    }

    #[test]
    fn test_slice() {
        let list = Value::Array(vec![
            Value::Number(1.into()),
            Value::Number(2.into()),
            Value::Number(3.into()),
            Value::Number(4.into()),
            Value::Number(5.into()),
        ]);
        let result = slice(&[list, Value::Number(1.into()), Value::Number(3.into())]).unwrap();
        if let Value::Array(arr) = result {
            assert_eq!(arr.len(), 2);
            assert_eq!(arr[0].to_string(), "2");
            assert_eq!(arr[1].to_string(), "3");
        } else {
            panic!("Expected array");
        }
    }

    #[test]
    fn test_until_step() {
        // Arguments are: start, step, end
        let result = until_step(&[
            Value::Number(0.into()),
            Value::Number(2.into()),
            Value::Number(10.into()),
        ])
        .unwrap();
        if let Value::Array(arr) = result {
            assert_eq!(arr.len(), 5);
            assert_eq!(arr[0].to_string(), "0");
            assert_eq!(arr[1].to_string(), "2");
            assert_eq!(arr[4].to_string(), "8");
        } else {
            panic!("Expected array");
        }
    }
}
