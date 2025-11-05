use core::str;
use gtmpl::{FuncError, Value};
use sha1::Sha1;
use sha2::{Digest, Sha256, Sha512};
extern crate bcrypt;

use bcrypt::DEFAULT_COST;

pub fn sha1sum(args: &[Value]) -> Result<Value, FuncError> {
    let to_be_hashed = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    let to_be_hashed = to_be_hashed.to_string();
    let to_be_hashed = to_be_hashed.as_bytes();

    let digest = Sha1::digest(to_be_hashed);

    let digest_hex_string = format!("{:x}", digest);

    Ok(Value::from(digest_hex_string))
}

pub fn sha256sum(args: &[Value]) -> Result<Value, FuncError> {
    let to_be_hashed = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    let to_be_hashed = to_be_hashed.to_string();

    let to_be_hashed = to_be_hashed.as_bytes();
    // hash with sha2 crate
    let digest = Sha256::digest(to_be_hashed);

    let digest_hex_string = format!("{:x}", digest);

    Ok(Value::from(digest_hex_string))
}

pub fn sha512sum(args: &[Value]) -> Result<Value, FuncError> {
    let to_be_hashed = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    let to_be_hashed = to_be_hashed.to_string();
    let to_be_hashed = to_be_hashed.as_bytes();

    let digest = Sha512::digest(to_be_hashed);

    let digest_hex_string = format!("{:x}", digest);

    Ok(Value::from(digest_hex_string))
}

pub fn md5sum(args: &[Value]) -> Result<Value, FuncError> {
    let to_be_hashed = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    let to_be_hashed = to_be_hashed.to_string();

    Ok(Value::from(format!(
        "{:x}",
        md5::compute(to_be_hashed.as_bytes())
    )))
}

pub fn htpasswd(args: &[Value]) -> Result<Value, FuncError> {
    let username = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let username = username.to_string();
    let password = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let password = password.to_string();

    let hashed = bcrypt::hash(password, DEFAULT_COST)
        .map_err(|_| FuncError::Generic("Invalid password".to_string()))?;
    Ok(Value::from(format!("{}:{}", username, hashed)))
}

pub fn mows_digest(args: &[Value]) -> Result<Value, FuncError> {
    let method = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let method = method.to_string();

    let to_be_hashed = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let to_be_hashed = to_be_hashed.to_string();
    let to_be_hashed = to_be_hashed.as_bytes();

    let hash = match method.as_str() {
        "MD5" => {
            let digest = md5::compute(to_be_hashed).to_ascii_lowercase();
            str::from_utf8(&digest)
                .map_err(|_| FuncError::Generic("Invalid hash".to_string()))?
                .to_string()
        }
        "SHA1" => {
            let digest = Sha1::digest(to_be_hashed);
            str::from_utf8(digest.as_slice())
                .map_err(|_| FuncError::Generic("Invalid hash".to_string()))?
                .to_string()
        }
        "SHA256" => {
            let digest = Sha256::digest(to_be_hashed);
            str::from_utf8(digest.as_slice())
                .map_err(|_| FuncError::Generic("Invalid hash".to_string()))?
                .to_string()
        }
        "SHA512" => {
            let digest = Sha512::digest(to_be_hashed);
            str::from_utf8(digest.as_slice())
                .map_err(|_| FuncError::Generic("Invalid hash".to_string()))?
                .to_string()
        }
        _ => return Err(FuncError::Generic("Invalid hash method".to_string())),
    };

    Ok(Value::from(hash))
}

pub fn random_string(args: &[Value]) -> Result<Value, FuncError> {
    let method = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let method = method.to_string();

    let length = args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    let length = length.to_string().replace(' ', "").parse::<u16>().unwrap();

    let mut charset: Vec<u8> = b"".to_vec();
    if method.contains('A') {
        charset.extend(b"ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    }
    if method.contains('a') {
        charset.extend(b"abcdefghijklmnopqrstuvwxyz");
    }
    if method.contains('0') {
        charset.extend(b"0123456789");
    }
    if method.contains('%') {
        charset.extend(b"%!@#$%^&*()_+-=[]{}|;':,./<>?`~");
    }
    let mut rng = rand::rng();

    let generated: String = (0..length)
        .map(|_| {
            let idx = rand::Rng::random_range(&mut rng, 0..charset.len());
            *charset.get(idx).unwrap() as char
        })
        .collect();

    Ok(Value::from(generated))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sha256sum() {
        let result = sha256sum(&[Value::String("hello".to_string())]).unwrap();
        assert_eq!(
            result.to_string(),
            "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
        );
    }

    #[test]
    fn test_sha1sum() {
        let result = sha1sum(&[Value::String("hello".to_string())]).unwrap();
        assert_eq!(result.to_string(), "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d");
    }

    #[test]
    fn test_md5sum() {
        let result = md5sum(&[Value::String("hello".to_string())]).unwrap();
        assert_eq!(result.to_string(), "5d41402abc4b2a76b9719d911017c592");
    }

    #[test]
    fn test_htpasswd() {
        let result = htpasswd(&[
            Value::String("user".to_string()),
            Value::String("pass".to_string()),
        ])
        .unwrap();
        let result_str = result.to_string();

        // Should start with username:
        assert!(result_str.starts_with("user:"));
        // Should have bcrypt hash (starts with $2)
        assert!(result_str.contains("$2"));
    }

    #[test]
    fn test_random_string_alpha() {
        let result = random_string(&[Value::String("Aa".to_string()), Value::Number(10.into())])
            .unwrap();
        let result_str = result.to_string();

        assert_eq!(result_str.len(), 10);
        // Should only contain letters
        assert!(result_str.chars().all(|c| c.is_alphabetic()));
    }

    #[test]
    fn test_random_string_numeric() {
        let result = random_string(&[Value::String("0".to_string()), Value::Number(10.into())])
            .unwrap();
        let result_str = result.to_string();

        assert_eq!(result_str.len(), 10);
        // Should only contain digits
        assert!(result_str.chars().all(|c| c.is_numeric()));
    }
}
