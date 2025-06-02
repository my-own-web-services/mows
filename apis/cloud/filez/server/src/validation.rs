pub async fn validate_file_name(file_name: &str) -> Result<(), anyhow::Error> {
    if file_name.len() > 255 {
        return Err(anyhow::anyhow!(
            "File name exceeds maximum length of 255 characters"
        ));
    }

    Ok(())
}
