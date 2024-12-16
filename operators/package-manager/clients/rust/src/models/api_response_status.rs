/*
 * mows-package-manager
 *
 * No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)
 *
 * The version of the OpenAPI document: 0.1.0
 * 
 * Generated by: https://openapi-generator.tech
 */

use crate::models;
use serde::{Deserialize, Serialize};

/// 
#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd, Hash, Serialize, Deserialize)]
pub enum ApiResponseStatus {
    #[serde(rename = "Success")]
    Success,
    #[serde(rename = "Error")]
    Error,

}

impl std::fmt::Display for ApiResponseStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        match self {
            Self::Success => write!(f, "Success"),
            Self::Error => write!(f, "Error"),
        }
    }
}

impl Default for ApiResponseStatus {
    fn default() -> ApiResponseStatus {
        Self::Success
    }
}

