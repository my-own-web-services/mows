mod git;
mod io;
mod yaml;

pub use git::find_git_root;
pub use io::{read_input, write_output};
pub use yaml::{format_yaml_error, parse_yaml};

// Re-export YAML indentation utilities from dedicated module
pub use crate::yaml_indent::detect_yaml_indent;
