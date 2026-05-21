//! Build-time OpenAPI dumper.
//!
//! Consumes the same `OpenApiRouter` graph the live server uses
//! (`mows_vm_supervisor::api::build_api_router`) and writes the resulting
//! OpenAPI document to stdout (or `--output <path>`).
//!
//! No database, no observability, no network — `OpenApiRouter::into_openapi`
//! only reads the route metadata that the `utoipa` derives baked in at
//! compile time. Replaces the legacy "boot the server, curl /openapi.json"
//! loop.
//!
//! CLI tool: no tracing subscriber is initialized; `eprintln!` is intentional
//! for fatal errors (TECH-RUST-7).
#![allow(clippy::print_stderr)]

use std::fs;
use std::io::{self, Write};
use std::process::ExitCode;

use clap::Parser;
use mows_vm_supervisor::api::build_api_router;

#[derive(Parser)]
#[command(
    about = "Dump the supervisor's OpenAPI document to stdout or a file.",
    long_about = None,
)]
struct Cli {
    /// Write the JSON document to this path instead of stdout.
    #[arg(short, long)]
    output: Option<String>,
}

fn main() -> ExitCode {
    let cli = Cli::parse();

    let openapi = build_api_router().into_openapi();
    let json = match openapi.to_pretty_json() {
        Ok(json) => json,
        Err(error) => {
            eprintln!("failed to serialize OpenAPI document: {error}");
            return ExitCode::from(1);
        }
    };

    match cli.output {
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
