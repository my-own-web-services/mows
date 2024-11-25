use axum::{
    http::{HeaderMap, Method, StatusCode, Uri},
    response::IntoResponse,
};
use include_dir::{include_dir, Dir};

static UI_DIR: Dir<'static> = include_dir!("$CARGO_MANIFEST_DIR/ui-build");

static ALL_HEADERS: [(&str, &str); 2] = [
    (
        "Strict-Transport-Security",
        "max-age=315360000; includeSubdomains; preload",
    ),
    ("Cache-Control", "public, max-age=31536000"),
];

static INDEX_HEADERS: [(&str, &str); 8] = [
    (
    "Content-Security-Policy",
    r#"
        default-src 'none';
        script-src 'self';
        style-src 'self';
        manifest-src 'self';
        connect-src 'self';
        img-src 'self';
        font-src 'self';
        base-uri 'none';
        form-action 'none';
        frame-ancestors 'none';
    "#,
    ),
    ("x-frame-options","DENY"),
    ("x-content-type-options","nosniff"),
    ("x-permitted-cross-domain-policies","none"),
    ("x-download-options","noopen"),
    ("x-xss-protection","1; mode=block"),
    ("referrer-policy", "no-referrer"),
    ("permissions-policy","accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), cross-origin-isolated=(), display-capture=(), document-domain=(), encrypted-media=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=(), geolocation=(), gyroscope=(), keyboard-map=(), magnetometer=(), microphone=(), midi=(), navigation-override=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(), usb=(), web-share=(), xr-spatial-tracking=(), clipboard-read=(), clipboard-write=(), gamepad=(), speaker-selection=(), conversion-measurement=(), focus-without-user-activation=(), hid=(), idle-detection=(), interest-cohort=(), serial=(), sync-script=(), trust-token-redemption=(), window-management=(), vertical-scroll=()")

];

pub async fn serve_spa(uri: Uri, method: Method) -> impl IntoResponse {
    if method != Method::GET {
        return (
            StatusCode::NOT_FOUND,
            HeaderMap::new(),
            "Not found".as_bytes(),
        );
    }

    let path = uri.path().trim_start_matches('/');
    let (file, is_index) = if path == "index.html" {
        (UI_DIR.get_file("index.html").unwrap(), true)
    } else {
        match UI_DIR.get_file(path) {
            Some(file) => (file, false),
            None => (UI_DIR.get_file("index.html").unwrap(), true),
        }
    };

    let content = file.contents();

    let mut headers = HeaderMap::new();

    let content_type = mime_guess::from_path(path).first_or(mime_guess::mime::TEXT_HTML_UTF_8);

    headers.insert("content-type", content_type.essence_str().parse().unwrap());

    for (key, value) in ALL_HEADERS {
        headers.insert(key, value.parse().unwrap());
    }

    if is_index {
        for (key, value) in INDEX_HEADERS {
            headers.insert(key, value.replace("\n", "").parse().unwrap());
        }
    }

    (StatusCode::OK, headers, content)
}
