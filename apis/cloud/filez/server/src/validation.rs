use crate::errors::FilezError;

pub fn validate_file_name(file_name: &str) -> Result<(), FilezError> {
    if file_name.len() > 255 {
        return Err(FilezError::ValidationError(
            "File name must not exceed 255 characters".to_string(),
        ));
    }

    Ok(())
}

pub fn validate_sha256_digest(digest: &str) -> Result<(), FilezError> {
    if digest.len() != 64 {
        return Err(FilezError::ValidationError(
            "SHA256 digest must be exactly 64 characters long".to_string(),
        ));
    }

    if !digest.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(FilezError::ValidationError(
            "SHA256 digest must contain only hexadecimal characters".to_string(),
        ));
    }

    if digest != digest.to_lowercase() {
        return Err(FilezError::ValidationError(
            "SHA256 digest must be in lowercase".to_string(),
        ));
    }

    Ok(())
}
