#![allow(unused_imports)]
use std::str::FromStr;

// some used only for telemetry feature
use crate::get_current_config_cloned;
use opentelemetry::trace::{TraceId, TracerProvider};
use opentelemetry_sdk::{runtime, trace as sdktrace, trace::Config, Resource};
use tracing_subscriber::{fmt::time::ChronoLocal, prelude::*, EnvFilter, Registry};

///  Fetch an opentelemetry::trace::TraceId as hex through the full tracing stack
pub fn get_trace_id() -> TraceId {
    use opentelemetry::trace::TraceContextExt as _; // opentelemetry::Context -> opentelemetry::trace::Span
    use tracing_opentelemetry::OpenTelemetrySpanExt as _; // tracing::Span to opentelemetry::Context
    tracing::Span::current()
        .context()
        .span()
        .span_context()
        .trace_id()
}

#[cfg(feature = "telemetry")]
fn resource() -> Resource {
    use opentelemetry::KeyValue;
    Resource::new([
        KeyValue::new("service.name", env!("CARGO_PKG_NAME")),
        KeyValue::new("service.version", env!("CARGO_PKG_VERSION")),
    ])
}

#[cfg(feature = "telemetry")]
async fn init_tracer() -> sdktrace::Tracer {
    let config = get_current_config_cloned!();
    use opentelemetry::global;
    use opentelemetry_otlp::WithExportConfig;
    use opentelemetry_sdk::propagation::TraceContextPropagator;

    let endpoint = config.otel_endpoint_url.clone();
    let exporter = opentelemetry_otlp::new_exporter().tonic().with_endpoint(endpoint);

    global::set_text_map_propagator(TraceContextPropagator::new());

    let provider = opentelemetry_otlp::new_pipeline()
        .tracing()
        .with_exporter(exporter)
        .with_trace_config(Config::default().with_resource(resource()))
        .install_batch(runtime::Tokio)
        .expect("valid tracer");

    opentelemetry::global::set_tracer_provider(provider.clone());
    provider.tracer("tracing-otel-subscriber")
}

/// Initialize tracing
pub async fn init_observability() {
    let config = get_current_config_cloned!();

    let tracing_filter = tracing_subscriber::EnvFilter::from_str(&config.tracing_filter).unwrap();

    // Setup tracing layers
    #[cfg(feature = "telemetry")]
    let otel =
        tracing_opentelemetry::OpenTelemetryLayer::new(init_tracer().await).with_filter(tracing_filter);

    let log_filter = tracing_subscriber::EnvFilter::from_str(&config.tracing_filter).unwrap();

    let logger = tracing_subscriber::fmt::layer()
        .with_ansi(true)
        .with_level(true)
        .with_timer(ChronoLocal::new("%H:%M:%S".to_string()))
        .with_file(true)
        .with_line_number(true)
        .with_target(false)
        .with_filter(log_filter);

    // Decide on layers
    let reg = Registry::default();
    #[cfg(feature = "telemetry")]
    reg.with(logger).with(otel).init();
    #[cfg(not(feature = "telemetry"))]
    reg.with(logger).init();
}
