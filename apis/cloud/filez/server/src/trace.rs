use axum::{extract::Request, http::HeaderMap, middleware::Next, response::Response};
use opentelemetry::propagation::{Extractor, TextMapPropagator};
use opentelemetry_sdk::propagation::TraceContextPropagator;
use tracing::Span;
use tracing_opentelemetry::OpenTelemetrySpanExt;

pub async fn traceparent_middleware(request: Request, next: Next) -> Response {
    let extractor = HeaderExtractor(request.headers());

    let propagator = TraceContextPropagator::new();
    let parent_context = propagator.extract(&extractor);

    let current_span = Span::current();

    current_span.set_parent(parent_context);

    let response = current_span
        .in_scope(|| async { next.run(request).await })
        .await;

    response
}

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
