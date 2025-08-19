use axum::{body::Body, extract::Request, http::HeaderMap, middleware::Next, response::Response};
use opentelemetry::{
    global,
    propagation::{Extractor, TextMapPropagator},
    trace::TraceContextExt,
    Context,
};
use opentelemetry_sdk::propagation::TraceContextPropagator;
use tracing::{info_span, Span};
use tracing_opentelemetry::OpenTelemetrySpanExt;

// Middleware to manually extract traceparent and create a span
pub async fn traceparent_middleware(mut request: Request, next: Next) -> Response {
    // 1. Create an extractor for the request headers.
    let extractor = HeaderExtractor(request.headers());

    // 2. Use the W3C TraceContextPropagator to extract the parent context.
    let propagator = TraceContextPropagator::new();
    let parent_context = propagator.extract(&extractor);

    // get the current span
    let current_span = Span::current();

    // 4. Attach the remote parent context to the new span.
    current_span.set_parent(parent_context);

    // 5. Execute the rest of the request handling within the scope of the new span.
    let response = current_span
        .in_scope(|| async { next.run(request).await })
        .await;

    response
}

// Helper struct to adapt `axum::http::HeaderMap` for OpenTelemetry's `Extractor` trait.
struct HeaderExtractor<'a>(&'a HeaderMap);

impl<'a> Extractor for HeaderExtractor<'a> {
    fn get(&self, key: &str) -> Option<&str> {
        self.0
            .get(key)
            .and_then(|header_value| header_value.to_str().ok())
    }

    fn keys(&self) -> Vec<&str> {
        self.0
            .keys()
            .map(|header_name| header_name.as_str())
            .collect()
    }
}
