use gtmpl::{FuncError, Value};

pub fn math_multiply(args: &[Value]) -> Result<Value, FuncError> {
    let a = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let b = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    let a = a
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    let b = b
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    Ok(Value::String((a * b).to_string()))
}

pub fn math_add(args: &[Value]) -> Result<Value, FuncError> {
    let a = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let b = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    let a = a
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    let b = b
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    Ok(Value::String((a + b).to_string()))
}

pub fn math_subtract(args: &[Value]) -> Result<Value, FuncError> {
    let a = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let b = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    let a = a
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    let b = b
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    Ok(Value::String((a - b).to_string()))
}

pub fn math_divide(args: &[Value]) -> Result<Value, FuncError> {
    let a = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let b = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    let a = a
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    let b = b
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    Ok(Value::String((a / b).to_string()))
}

pub fn math_modulo(args: &[Value]) -> Result<Value, FuncError> {
    let a = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let b = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    let a = a
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    let b = b
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    Ok(Value::String((a % b).to_string()))
}

pub fn math_power(args: &[Value]) -> Result<Value, FuncError> {
    let a = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments".to_string(),
        2,
    ))?;
    let b = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    let a = a
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    let b = b
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    Ok(Value::String((a.powf(b)).to_string()))
}

/// Add 1 to a number
pub fn add1(args: &[Value]) -> Result<Value, FuncError> {
    let a = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    let a = a
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    Ok(Value::String((a + 1.0).to_string()))
}

/// Find maximum value
pub fn max(args: &[Value]) -> Result<Value, FuncError> {
    if args.is_empty() {
        return Err(FuncError::AtLeastXArgs(
            "This function requires at least 1 argument.".to_string(),
            1,
        ));
    }

    let mut max_val = f64::NEG_INFINITY;
    for arg in args {
        let val = arg
            .to_string()
            .parse::<f64>()
            .map_err(|_| FuncError::UnableToConvertFromValue)?;
        if val > max_val {
            max_val = val;
        }
    }

    Ok(Value::String(max_val.to_string()))
}

/// Find minimum value
pub fn min(args: &[Value]) -> Result<Value, FuncError> {
    if args.is_empty() {
        return Err(FuncError::AtLeastXArgs(
            "This function requires at least 1 argument.".to_string(),
            1,
        ));
    }

    let mut min_val = f64::INFINITY;
    for arg in args {
        let val = arg
            .to_string()
            .parse::<f64>()
            .map_err(|_| FuncError::UnableToConvertFromValue)?;
        if val < min_val {
            min_val = val;
        }
    }

    Ok(Value::String(min_val.to_string()))
}

/// Float addition
pub fn addf(args: &[Value]) -> Result<Value, FuncError> {
    let a = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let b = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    let a = a
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    let b = b
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    Ok(Value::Number((a + b).into()))
}

/// Float add 1
pub fn add1f(args: &[Value]) -> Result<Value, FuncError> {
    let a = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    let a = a
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    Ok(Value::Number((a + 1.0).into()))
}

/// Float subtraction
pub fn subf(args: &[Value]) -> Result<Value, FuncError> {
    let a = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let b = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    let a = a
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    let b = b
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    Ok(Value::Number((a - b).into()))
}

/// Float division
pub fn divf(args: &[Value]) -> Result<Value, FuncError> {
    let a = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let b = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    let a = a
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    let b = b
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    Ok(Value::Number((a / b).into()))
}

/// Float multiplication
pub fn mulf(args: &[Value]) -> Result<Value, FuncError> {
    let a = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let b = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    let a = a
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    let b = b
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    Ok(Value::Number((a * b).into()))
}

/// Float maximum
pub fn maxf(args: &[Value]) -> Result<Value, FuncError> {
    if args.is_empty() {
        return Err(FuncError::AtLeastXArgs(
            "This function requires at least 1 argument.".to_string(),
            1,
        ));
    }

    let mut max_val = f64::NEG_INFINITY;
    for arg in args {
        let val = arg
            .to_string()
            .parse::<f64>()
            .map_err(|_| FuncError::UnableToConvertFromValue)?;
        if val > max_val {
            max_val = val;
        }
    }

    Ok(Value::Number(max_val.into()))
}

/// Float minimum
pub fn minf(args: &[Value]) -> Result<Value, FuncError> {
    if args.is_empty() {
        return Err(FuncError::AtLeastXArgs(
            "This function requires at least 1 argument.".to_string(),
            1,
        ));
    }

    let mut min_val = f64::INFINITY;
    for arg in args {
        let val = arg
            .to_string()
            .parse::<f64>()
            .map_err(|_| FuncError::UnableToConvertFromValue)?;
        if val < min_val {
            min_val = val;
        }
    }

    Ok(Value::Number(min_val.into()))
}

/// Floor function
pub fn floor(args: &[Value]) -> Result<Value, FuncError> {
    let a = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    let a = a
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    Ok(Value::Number(a.floor().into()))
}

/// Ceiling function
pub fn ceil(args: &[Value]) -> Result<Value, FuncError> {
    let a = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    let a = a
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    Ok(Value::Number(a.ceil().into()))
}

/// Round function
pub fn round(args: &[Value]) -> Result<Value, FuncError> {
    let a = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    let decimals = if let Some(d) = args.get(1) {
        d.to_string()
            .parse::<i32>()
            .map_err(|_| FuncError::UnableToConvertFromValue)?
    } else {
        0
    };

    let a = a
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    let multiplier = 10_f64.powi(decimals);
    let rounded = (a * multiplier).round() / multiplier;

    Ok(Value::Number(rounded.into()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_math_add() {
        let result = math_add(&[Value::Number(3.into()), Value::Number(5.into())]).unwrap();
        assert_eq!(result.to_string(), "8");
    }

    #[test]
    fn test_math_subtract() {
        let result =
            math_subtract(&[Value::Number(10.into()), Value::Number(4.into())]).unwrap();
        assert_eq!(result.to_string(), "6");
    }

    #[test]
    fn test_math_multiply() {
        let result =
            math_multiply(&[Value::Number(3.into()), Value::Number(4.into())]).unwrap();
        assert_eq!(result.to_string(), "12");
    }

    #[test]
    fn test_math_divide() {
        let result = math_divide(&[Value::Number(10.into()), Value::Number(2.into())]).unwrap();
        assert_eq!(result.to_string(), "5");
    }

    #[test]
    fn test_max() {
        let result = max(&[
            Value::Number(1.into()),
            Value::Number(5.into()),
            Value::Number(3.into()),
        ])
        .unwrap();
        assert_eq!(result.to_string(), "5");
    }

    #[test]
    fn test_min() {
        let result = min(&[
            Value::Number(1.into()),
            Value::Number(5.into()),
            Value::Number(3.into()),
        ])
        .unwrap();
        assert_eq!(result.to_string(), "1");
    }

    #[test]
    fn test_floor() {
        let result = floor(&[Value::Number(3.7.into())]).unwrap();
        assert_eq!(result.to_string(), "3");
    }

    #[test]
    fn test_ceil() {
        let result = ceil(&[Value::Number(3.2.into())]).unwrap();
        assert_eq!(result.to_string(), "4");
    }

    #[test]
    fn test_round() {
        let result = round(&[Value::Number(3.567.into()), Value::Number(2.into())]).unwrap();
        assert_eq!(result.to_string(), "3.57");
    }

    #[test]
    fn test_round_no_decimals() {
        let result = round(&[Value::Number(3.567.into())]).unwrap();
        assert_eq!(result.to_string(), "4");
    }

    #[test]
    fn test_add1() {
        let result = add1(&[Value::Number(5.into())]).unwrap();
        assert_eq!(result.to_string(), "6");
    }

    #[test]
    fn test_math_power() {
        let result = math_power(&[Value::Number(2.into()), Value::Number(3.into())]).unwrap();
        assert_eq!(result.to_string(), "8");
    }

    #[test]
    fn test_math_modulo() {
        let result = math_modulo(&[Value::Number(10.into()), Value::Number(3.into())]).unwrap();
        assert_eq!(result.to_string(), "1");
    }
}
