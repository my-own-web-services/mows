use rand::Rng;
use std::path::Path;

use anyhow::Context;
use tokio::fs;

pub fn generate_id(length: usize) -> String {
    const CHARSET: &[u8; 62] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    let mut rng = rand::rng();

    (0..length)
        .map(|_| {
            let idx = rng.random_range(0..CHARSET.len());
            *CHARSET.get(idx).unwrap() as char
        })
        .collect()
}

// copy the contents of the source directory into the destination directory

pub async fn copy_directory_recursive(
    source_path: &Path,
    destination_path: &Path,
    copy_operation_limit: usize,
) -> anyhow::Result<()> {
    let source_base = source_path.to_path_buf();
    let destination_base = destination_path.to_path_buf();
    let mut stack = vec![source_path.to_path_buf()];
    let mut count = 0;
    while let Some(source) = stack.pop() {
        // Calculate the relative path from the source base
        let rel_path = source.strip_prefix(&source_base)?;
        // Append it to the destination base to get the correct destination path
        let destination = destination_base.join(rel_path);

        if source.is_dir() {
            match fs::create_dir(&destination).await {
                Ok(_) => {}
                Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {}
                Err(e) => {
                    return Err(e).context(format!(
                        "Failed to create directory {}",
                        destination.display()
                    ))
                }
            };

            let mut entries = fs::read_dir(&source).await?;
            while let Some(entry) = entries.next_entry().await? {
                if count > copy_operation_limit {
                    return Err(anyhow::anyhow!(
                        "Exceeded file limit of {copy_operation_limit} items"
                    ));
                }
                stack.push(entry.path());
                count += 1;
            }
        } else {
            fs::copy(&source, &destination).await.context(format!(
                "Failed to copy file from {} to {}",
                source.display(),
                destination.display()
            ))?;
        }
    }

    Ok(())
}
