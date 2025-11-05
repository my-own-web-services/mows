use core::str;
use gtmpl::{FuncError, Value};

pub fn b64enc(args: &[Value]) -> Result<Value, FuncError> {
    let content = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    let content = content.to_string();
    Ok(Value::from(
        data_encoding::BASE64.encode(content.as_bytes()),
    ))
}

pub fn b64dec(args: &[Value]) -> Result<Value, FuncError> {
    let content = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    let content = content.to_string();
    Ok(Value::from(
        str::from_utf8(
            &data_encoding::BASE64
                .decode(content.as_bytes())
                .map_err(|_| FuncError::Generic("Invalid base64 string".to_string()))?,
        )
        .map_err(|_| FuncError::Generic("Invalid base64 string".to_string()))?,
    ))
}

pub fn b32enc(args: &[Value]) -> Result<Value, FuncError> {
    let content = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    let content = content.to_string();
    Ok(Value::from(
        data_encoding::BASE32.encode(content.as_bytes()),
    ))
}

pub fn b32dec(args: &[Value]) -> Result<Value, FuncError> {
    let content = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    let content = content.to_string();
    Ok(Value::from(
        str::from_utf8(
            &data_encoding::BASE32
                .decode(content.as_bytes())
                .map_err(|_| FuncError::Generic("Invalid base32 string".to_string()))?,
        )
        .map_err(|_| FuncError::Generic("Invalid base32 string".to_string()))?,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_b64enc() {
        let result = b64enc(&[Value::String("hello".to_string())]).unwrap();
        assert_eq!(result.to_string(), "aGVsbG8=");
    }

    #[test]
    fn test_b64dec() {
        let result = b64dec(&[Value::String("aGVsbG8=".to_string())]).unwrap();
        assert_eq!(result.to_string(), "hello");
    }

    #[test]
    fn test_b32enc() {
        let result = b32enc(&[Value::String("hello".to_string())]).unwrap();
        assert_eq!(result.to_string(), "NBSWY3DP");
    }

    #[test]
    fn test_b32dec() {
        let result = b32dec(&[Value::String("NBSWY3DP".to_string())]).unwrap();
        assert_eq!(result.to_string(), "hello");
    }

    #[test]
    fn test_b64_roundtrip() {
        let original = "Hello, World! 123";
        let encoded = b64enc(&[Value::String(original.to_string())]).unwrap();
        let decoded = b64dec(&[encoded]).unwrap();
        assert_eq!(decoded.to_string(), original);
    }
}
