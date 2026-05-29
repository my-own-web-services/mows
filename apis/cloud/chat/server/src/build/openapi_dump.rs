//! Build-time OpenAPI dumper for chat-server. Mirrors filez's
//! `openapi_dump` binary; consumed by `scripts/codegen.sh`.

use std::env;
use std::fs;
use std::io::{self, Write};
use std::process::ExitCode;

use chat_server_lib::api_router::build_api_router;
use utoipa_axum::router::OpenApiRouter;

fn main() -> ExitCode {
    let args: Vec<String> = env::args().collect();
    let output_path = parse_output_path(&args);

    let router = build_api_router();
    let (_axum_router, openapi) = OpenApiRouter::split_for_parts(router);
    let json = match openapi.to_pretty_json() {
        Ok(json) => json,
        Err(error) => {
            eprintln!("failed to serialise OpenAPI document: {error}");
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
