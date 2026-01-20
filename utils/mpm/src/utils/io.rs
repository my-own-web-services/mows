use std::fs;
use std::io::{self, Read};
use std::path::PathBuf;
use tracing::trace;

use crate::error::{IoResultExt, Result};

pub fn read_input(input: &Option<PathBuf>) -> Result<String> {
    match input {
        Some(path) => {
            trace!("Reading input from file: {}", path.display());
            fs::read_to_string(path)
                .io_context(format!("Failed to read file '{}'", path.display()))
        }
        None => {
            trace!("Reading input from stdin");
            let mut buffer = String::new();
            io::stdin()
                .read_to_string(&mut buffer)
                .io_context("Failed to read from stdin")?;
            Ok(buffer)
        }
    }
}

pub fn write_output(output: &Option<PathBuf>, content: &str) -> Result<()> {
    match output {
        Some(path) => {
            trace!("Writing output to file: {}", path.display());
            fs::write(path, content)
                .io_context(format!("Failed to write to file '{}'", path.display()))
        }
        None => {
            trace!("Writing output to stdout");
            print!("{}", content);
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_read_input_from_file() {
        let mut temp_file = NamedTempFile::new().unwrap();
        write!(temp_file, "test content").unwrap();
        temp_file.flush().unwrap();

        let path = Some(temp_file.path().to_path_buf());
        let result = read_input(&path).unwrap();
        assert_eq!(result, "test content");
    }

    #[test]
    fn test_write_output_to_file() {
        let temp_file = NamedTempFile::new().unwrap();
        let path = Some(temp_file.path().to_path_buf());

        write_output(&path, "test output").unwrap();

        let content = fs::read_to_string(temp_file.path()).unwrap();
        assert_eq!(content, "test output");
    }
}
