//! Dumps the authz-admin OpenAPI spec to a file at build time.
//! No live server, no docker. Same pattern as realtime / filez.

use std::path::PathBuf;

use anyhow::Context;
use authz_admin_server_lib::api_router::build_api_router;
use utoipa_axum::router::OpenApiRouter;

fn main() -> anyhow::Result<()> {
    let mut args = std::env::args().skip(1);
    let mut output: Option<PathBuf> = None;
    while let Some(a) = args.next() {
        if a == "--output" {
            output = args.next().map(PathBuf::from);
        }
    }
    let output = output.ok_or_else(|| anyhow::anyhow!("--output <path> required"))?;

    let router = build_api_router();
    let (_axum, openapi) = OpenApiRouter::<authz_admin_server_lib::state::AppState>::split_for_parts(router);
    let json = openapi.to_pretty_json().context("serialising openapi")?;
    std::fs::write(&output, json).with_context(|| format!("writing {output:?}"))?;
    Ok(())
}
