//! Build-time OpenAPI dumper.
//!
//! Compiles the same `OpenApiRouter` graph the live server uses
//! (`filez_server_lib::api_router::build_api_router`) and writes the
//! resulting OpenAPI document to stdout (or `--output <path>`).
//!
//! No database, no observability, no network — the router is consumed by
//! `OpenApiRouter::into_openapi(self)`, which only reads the route metadata
//! that the `utoipa` derives baked in at compile time. Replaces the legacy
//! "boot the server, `curl /api-docs/openapi.json`" loop in
//! `scripts/codegen.sh`.

use filez_server_lib::api_router::build_api_router;
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
            // Trailing newline keeps the file POSIX-compliant when redirected.
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
