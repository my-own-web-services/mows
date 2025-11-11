use crate::{config::common_config, get_current_config_cloned};

use opentelemetry::trace::{TraceId, TracerProvider};

use opentelemetry_sdk::{runtime, trace as sdktrace, trace::Config, Resource};
use std::str::FromStr;
use tracing_subscriber::{fmt::time::ChronoLocal, prelude::*, Registry};

pub fn get_trace_id() -> TraceId {
    use opentelemetry::trace::TraceContextExt as _; // opentelemetry::Context -> opentelemetry::trace::Span
    use tracing_opentelemetry::OpenTelemetrySpanExt as _; // tracing::Span to opentelemetry::Context
    tracing::Span::current()
        .context()
        .span()
        .span_context()
        .trace_id()
}

async fn resource() -> Resource {
    use opentelemetry::KeyValue;

    use crate::config::common_config;
    let config = get_current_config_cloned!(common_config(true));
    Resource::new([
        KeyValue::new("service.name", config.service_name),
        KeyValue::new("service.version", config.service_version),
    ])
}

async fn init_tracer() -> sdktrace::Tracer {
    use opentelemetry::global;
    use opentelemetry_otlp::WithExportConfig;
    use opentelemetry_sdk::propagation::TraceContextPropagator;

    use crate::{config::common_config, get_current_config_cloned};

    let config = get_current_config_cloned!(common_config(true));

    let endpoint = config.otel_endpoint_url.clone();
    let exporter = opentelemetry_otlp::new_exporter()
        .tonic()
        .with_endpoint(endpoint);

    global::set_text_map_propagator(TraceContextPropagator::default());

    let provider = opentelemetry_otlp::new_pipeline()
        .tracing()
        .with_exporter(exporter)
        .with_trace_config(Config::default().with_resource(resource().await))
        .install_batch(runtime::Tokio)
        .expect("valid tracer");

    opentelemetry::global::set_tracer_provider(provider.clone());
    provider.tracer("tracing-otel-subscriber")
}

/// Initialize tracing
pub async fn init_observability() {
    let config = get_current_config_cloned!(common_config(true));

    let tracing_filter = tracing_subscriber::EnvFilter::from_str(&config.tracing_filter).unwrap();

    let otel = tracing_opentelemetry::OpenTelemetryLayer::new(init_tracer().await)
        .with_filter(tracing_filter);

    let log_filter = tracing_subscriber::EnvFilter::from_str(&config.log_filter).unwrap();

    println!("Parsed log filter: {}", log_filter);

    let logger = tracing_subscriber::fmt::layer()
        .with_ansi(true)
        .with_level(true)
        .with_timer(ChronoLocal::new("%H:%M:%S".to_string()))
        .with_file(true)
        .with_line_number(true)
        .with_target(true)
        .with_filter(log_filter);

    let reg = Registry::default();

    reg.with(logger).with(otel).init();
}

pub async fn init_minimal_observability(level: &str) -> anyhow::Result<()> {
    init_minimal_observability_with_color(level, true).await
}

pub async fn init_minimal_observability_with_color(level: &str, use_color: bool) -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(level)
        .with_ansi(use_color)
        .init();
    Ok(())
}
