//! Static-file fallback that serves the embedded web UI (the React app under
//! `web/dist/`) for any GET that doesn't match a `/v1/...` route.
//!
//! At build time the supervisor's `build.rs` ensures `web/dist/` exists;
//! `include_dir::include_dir!` then bakes every file into the binary, so
//! deployment is just the single static binary plus the qcow2 image.
//!
//! Routes:
//! - `GET /` → `index.html`
//! - `GET /assets/<file>` → matching file with the right Content-Type
//! - `GET /<anything-else>` → `index.html` (so client-side routing works
//!   on direct URL hits like `/vms/<id>`)

use axum::body::Body;
use axum::http::{header, HeaderMap, HeaderValue, StatusCode, Uri};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::Router;
use include_dir::{include_dir, Dir};

use crate::state::SharedState;

static WEB_DIST: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/web/dist");

pub fn router() -> Router<SharedState> {
    Router::new().fallback(get(serve_static))
}

async fn serve_static(uri: Uri) -> Response {
    let path = uri.path().trim_start_matches('/');

    // /v1/... never falls through to here, but be defensive.
    if path.starts_with("v1/") {
        return (StatusCode::NOT_FOUND, "not found").into_response();
    }

    // Direct hit on a packaged asset.
    if let Some(file) = WEB_DIST.get_file(path) {
        return file_response(path, file.contents());
    }

    // SPA fallback: any other GET serves index.html so client-side routes
    // (`/vms/<id>` etc.) resolve when the user reloads the page.
    if let Some(index) = WEB_DIST.get_file("index.html") {
        return file_response("index.html", index.contents());
    }

    // Build hasn't run — happens in `cargo run` from a clean checkout. Surface
    // a clear hint instead of an opaque 404.
    let body = "web UI not built; run `pnpm --dir utils/mows-vm-supervisor/web build` first";
    (StatusCode::NOT_FOUND, body).into_response()
}

// Locked-down CSP for the supervisor UI. The backend is same-origin and
// websockets terminate at the same host, so `'self'` everywhere is
// sufficient. `style-src 'unsafe-inline'` is required because Tailwind
// emits some inline styles; `img-src` and `media-src` allow data: + blob:
// so VNC framebuffer canvases and console exports keep working.
const CSP_HEADER: &str = "default-src 'self'; \
img-src 'self' data: blob:; \
media-src 'self' blob:; \
worker-src 'self' blob:; \
connect-src 'self' ws: wss:; \
style-src 'self' 'unsafe-inline'; \
script-src 'self'; \
frame-ancestors 'none'; \
base-uri 'self'; \
form-action 'self'";

fn file_response(path: &str, bytes: &'static [u8]) -> Response {
    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static(content_type_for(path)),
    );
    // Hashed assets under /assets/ are immutable — long cache. Everything
    // else (index.html, fonts named by hash too, but treat conservatively)
    // gets a short cache so deploys take effect.
    let cache = if path.starts_with("assets/") {
        "public, max-age=31536000, immutable"
    } else {
        "no-cache"
    };
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static(cache));

    // Defence-in-depth response headers. Apply to every static asset
    // (HTML, JS, CSS, fonts, …) so an XSS landed via any of them is
    // contained by the CSP, and so the UI cannot be iframed or sniffed
    // into a script context.
    headers.insert(
        header::CONTENT_SECURITY_POLICY,
        HeaderValue::from_static(CSP_HEADER),
    );
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        HeaderValue::from_static("nosniff"),
    );
    headers.insert(
        header::X_FRAME_OPTIONS,
        HeaderValue::from_static("DENY"),
    );
    headers.insert(
        header::REFERRER_POLICY,
        HeaderValue::from_static("same-origin"),
    );
    headers.insert(
        header::HeaderName::from_static("cross-origin-resource-policy"),
        HeaderValue::from_static("same-origin"),
    );

    (StatusCode::OK, headers, Body::from(bytes)).into_response()
}

fn content_type_for(path: &str) -> &'static str {
    match path.rsplit_once('.').map(|(_, ext)| ext) {
        Some("html") => "text/html; charset=utf-8",
        Some("js") | Some("mjs") => "application/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("json") => "application/json; charset=utf-8",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("woff2") => "font/woff2",
        Some("woff") => "font/woff",
        Some("ico") => "image/x-icon",
        Some("map") => "application/json; charset=utf-8",
        _ => "application/octet-stream",
    }
}

// Tiny smoke test: at minimum, index.html must be embedded so production
// boots don't 404 the root page.
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn index_html_is_embedded() {
        // `web/dist` is created by `pnpm build`; this test will fail in a
        // clean checkout until that runs once. The build script will keep
        // it warm.
        assert!(
            WEB_DIST.get_file("index.html").is_some(),
            "web/dist/index.html missing — run `pnpm --dir web build`",
        );
    }

    #[test]
    fn content_type_picks_known_extensions() {
        assert_eq!(content_type_for("index.html"), "text/html; charset=utf-8");
        assert_eq!(content_type_for("assets/x.js"), "application/javascript; charset=utf-8");
        assert_eq!(content_type_for("assets/y.css"), "text/css; charset=utf-8");
        assert_eq!(content_type_for("assets/font.woff2"), "font/woff2");
    }
}
