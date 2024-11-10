use crate::{config, get_current_config_cloned};
use http::Extensions;
use reqwest_middleware::{ClientBuilder, ClientWithMiddleware, Result};
use reqwest_tracing::{
    default_on_request_end, reqwest_otel_span, ReqwestOtelSpanBackend, TracingMiddleware,
};

pub struct ReqwestTrace;

impl ReqwestOtelSpanBackend for ReqwestTrace {
    fn on_request_start(req: &reqwest::Request, extension: &mut Extensions) -> tracing::Span {
        reqwest_otel_span!(name = "name", req)
    }

    fn on_request_end(
        span: &tracing::Span,
        outcome: &Result<reqwest::Response>,
        extension: &mut Extensions,
    ) {
        default_on_request_end(span, outcome)
    }
}

pub async fn new_reqwest_client() -> Result<ClientWithMiddleware> {
    let config = get_current_config_cloned!(config::common_config());
    let client = reqwest::Client::builder()
        .user_agent(format!(
            "{}/{}",
            config.service_name, config.service_version
        ))
        .build()?;

    let client = ClientBuilder::new(client)
        .with(TracingMiddleware::default())
        .build();

    Ok(client)
}
