//! Build-time OpenAPI dumper.
//!
//! Compiles the same `OpenApiRouter` graph the manager binary uses
//! (`manager::api::openapi::build_api_router`) and writes the resulting
//! OpenAPI document to stdout (or `--output <path>`).
//!
//! No background tasks, no DNS/pixiecore boot, no network — the router is
//! consumed by `OpenApiRouter::into_openapi(self)`, which only reads the
//! compile-time `utoipa` metadata. Replaces "boot the server, `curl
//! /api-docs/openapi.json`" in `manager/docker/codegen.Dockerfile`.

use manager::api::openapi::build_api_router;
use std::env;
use std::fs;
use std::io::{self, Write};
use std::process::ExitCode;

fn main() -> ExitCode {
    let args: Vec<String> = env::args().collect();
    let output_path = parse_output_path(&args);

    let openapi = build_api_router().into_openapi();
    let json = match openapi.to_pretty_json() {
        Ok(json) => json,
        Err(error) => {
            eprintln!("failed to serialize OpenAPI document: {error}");
            return ExitCode::from(1);
        }
    };

    match output_path {
        Some(path) => {
            if let Err(error) = fs::write(&path, &json) {
                eprintln!("failed to write {path}: {error}");
                return ExitCode::from(1);
            }
        }
        None => {
            let stdout = io::stdout();
            let mut handle = stdout.lock();
            if let Err(error) = handle.write_all(json.as_bytes()) {
                eprintln!("failed to write stdout: {error}");
                return ExitCode::from(1);
            }
            let _ = handle.write_all(b"\n");
        }
    }

    ExitCode::SUCCESS
}

fn parse_output_path(args: &[String]) -> Option<String> {
    let mut iter = args.iter().skip(1);
    while let Some(arg) = iter.next() {
        match arg.as_str() {
            "--output" | "-o" => return iter.next().cloned(),
            other if other.starts_with("--output=") => {
                return Some(other.trim_start_matches("--output=").to_string());
            }
            _ => {}
        }
    }
    None
}
