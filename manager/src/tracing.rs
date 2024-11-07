use opentelemetry::KeyValue;
use opentelemetry_otlp::WithExportConfig;
use opentelemetry_sdk::{
    runtime,
    trace::{BatchConfig, RandomIdGenerator, Sampler, TracerProvider},
    Resource,
};
use opentelemetry_semantic_conventions::{
    resource::{DEPLOYMENT_ENVIRONMENT_NAME, SERVICE_NAME, SERVICE_VERSION},
    SCHEMA_URL,
};
use std::{net::Ipv6Addr, str::FromStr};
use tracing_subscriber::{
    fmt::time::ChronoLocal, layer::SubscriberExt, util::SubscriberInitExt, Layer,
};

pub async fn start_tracing() -> anyhow::Result<()> {
    //let _ = Docker::connect_with_local_defaults();
    let console_layer = console_subscriber::ConsoleLayer::builder()
        .server_addr((Ipv6Addr::from_str("::")?, 6669))
        .spawn()
        .with_filter(tracing_subscriber::EnvFilter::new(
            "main=trace,manager=trace,tower_http=trace,axum::rejection=trace,tokio=trace,runtime=trace"
            ,
        ));

    let log_filter = tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| {
        // axum logs rejections from built-in extractors with the `axum::rejection`
        // target, at `TRACE` level. `axum::rejection=trace` enables showing those events
        "main=debug,manager=debug,tower_http=trace,axum::rejection=trace,tokio=debug,runtime=debug"
            .into()
    });
    let log_layer = tracing_subscriber::fmt::layer()
        .with_ansi(true)
        .with_level(true)
        .with_timer(ChronoLocal::new("%H:%M:%S".to_string()))
        .with_file(true)
        .with_line_number(true)
        .with_target(false)
        .with_filter(log_filter);
    /*
        let tracing_layer = tracing_opentelemetry::OpenTelemetryLayer::new(
            manager::tracing::init_tracer("http://jaeger:4317"),
        )
        .with_filter(tracing_subscriber::EnvFilter::new(
            "main=trace,manager=trace,tower_http=trace,axum::rejection=trace,tokio=trace,runtime=trace",
        ));
    */
    tracing_subscriber::registry()
        .with(console_layer)
        .with(log_layer)
        //.with(tracing_layer)
        .try_init()?;

    Ok(())
}

fn resource() -> Resource {
    Resource::from_schema_url(
        [
            KeyValue::new(SERVICE_NAME, env!("CARGO_PKG_NAME")),
            KeyValue::new(SERVICE_VERSION, env!("CARGO_PKG_VERSION")),
            KeyValue::new(DEPLOYMENT_ENVIRONMENT_NAME, "develop"),
        ],
        SCHEMA_URL,
    )
}

pub fn init_tracer(exporter_endpoint: &str) -> TracerProvider {
    let tracer = opentelemetry_otlp::new_pipeline()
        .tracing()
        .with_trace_config(
            opentelemetry_sdk::trace::Config::default()
                // Customize sampling strategy
                .with_sampler(Sampler::ParentBased(Box::new(Sampler::TraceIdRatioBased(
                    1.0,
                ))))
                // If export trace to AWS X-Ray, you can use XrayIdGenerator
                .with_id_generator(RandomIdGenerator::default())
                .with_resource(resource()),
        )
        .with_batch_config(BatchConfig::default())
        .with_exporter(
            opentelemetry_otlp::new_exporter()
                .tonic()
                .with_endpoint(exporter_endpoint),
        )
        .install_batch(runtime::Tokio)
        .unwrap();

    tracer
}
