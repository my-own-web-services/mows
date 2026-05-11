//! Tiny HTTP client for the mows-vm-supervisor.
//!
//! v1: blocking HTTP over `127.0.0.1:7878` with a bearer token. Unix-socket
//! transport will land alongside auto-start support for the supervisor
//! container — see `.plans/agent-vm/PLAN.md`.

use std::time::Duration;

use serde::de::DeserializeOwned;
use serde::Serialize;

use crate::error::{MowsError, Result};

const DEFAULT_BASE_URL: &str = "http://127.0.0.1:7878";

pub struct SupervisorClient {
    base_url: String,
    token: Option<String>,
    http: reqwest::blocking::Client,
}

impl SupervisorClient {
    pub fn from_env() -> Result<Self> {
        let base_url = std::env::var("MOWS_VM_SUPERVISOR_URL")
            .unwrap_or_else(|_| DEFAULT_BASE_URL.to_string());
        let token = read_token_from_env()?;
        let http = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| MowsError::Config(format!("failed to build http client: {e}")))?;
        Ok(Self {
            base_url,
            token,
            http,
        })
    }

    pub fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T> {
        let url = format!("{}{}", self.base_url, path);
        let mut req = self.http.get(&url);
        if let Some(t) = &self.token {
            req = req.bearer_auth(t);
        }
        let resp = req
            .send()
            .map_err(|e| MowsError::Config(format!("supervisor GET {path}: {e}")))?;
        if !resp.status().is_success() {
            return Err(supervisor_error(&url, resp));
        }
        resp.json::<T>()
            .map_err(|e| MowsError::Config(format!("supervisor GET {path}: bad json: {e}")))
    }

    pub fn post<B: Serialize, T: DeserializeOwned>(&self, path: &str, body: &B) -> Result<T> {
        let url = format!("{}{}", self.base_url, path);
        let mut req = self.http.post(&url).json(body);
        if let Some(t) = &self.token {
            req = req.bearer_auth(t);
        }
        let resp = req
            .send()
            .map_err(|e| MowsError::Config(format!("supervisor POST {path}: {e}")))?;
        if !resp.status().is_success() {
            return Err(supervisor_error(&url, resp));
        }
        resp.json::<T>()
            .map_err(|e| MowsError::Config(format!("supervisor POST {path}: bad json: {e}")))
    }

    pub fn delete(&self, path: &str) -> Result<()> {
        let url = format!("{}{}", self.base_url, path);
        let mut req = self.http.delete(&url);
        if let Some(t) = &self.token {
            req = req.bearer_auth(t);
        }
        let resp = req
            .send()
            .map_err(|e| MowsError::Config(format!("supervisor DELETE {path}: {e}")))?;
        if !resp.status().is_success() {
            return Err(supervisor_error(&url, resp));
        }
        Ok(())
    }
}

fn read_token_from_env() -> Result<Option<String>> {
    if let Ok(path) = std::env::var("MOWS_VM_SUPERVISOR_API_TOKEN_FILE") {
        let raw = std::fs::read_to_string(&path).map_err(|e| {
            MowsError::Config(format!(
                "failed to read MOWS_VM_SUPERVISOR_API_TOKEN_FILE={path}: {e}"
            ))
        })?;
        return Ok(Some(raw.trim().to_string()));
    }
    Ok(std::env::var("MOWS_VM_SUPERVISOR_API_TOKEN").ok())
}

fn supervisor_error(url: &str, resp: reqwest::blocking::Response) -> MowsError {
    let status = resp.status();
    let body = resp.text().unwrap_or_default();
    MowsError::Config(format!("supervisor {url} returned {status}: {body}"))
}
