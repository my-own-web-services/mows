use serde::{Deserialize, Serialize};

use crate::openapi_client_generator::generators::rust::RustGeneratorConfig;

pub mod rust;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum GeneratorType {
    Rust(RustGeneratorConfig),
}
