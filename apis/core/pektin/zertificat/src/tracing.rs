use tracing_subscriber::{
    fmt::time::ChronoLocal, layer::SubscriberExt, util::SubscriberInitExt, Layer,
};

pub async fn start_tracing() -> anyhow::Result<()> {
    //let _ = Docker::connect_with_local_defaults();

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
        .with(log_layer)
        //.with(tracing_layer)
        .try_init()?;

    Ok(())
}
