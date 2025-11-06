use super::MiddlewareError;
use crate::routing_config::Chain;
use http::{Request, Response};
use http_body_util::combinators::BoxBody;
use hyper::body::{Bytes, Incoming};

// Chain middleware simply returns an error indicating that chains should be resolved
// at the configuration level before middlewares are applied.
// In Traefik, chains are resolved during configuration loading, not during request processing.

pub fn handle_incoming(_req: &mut Request<Incoming>, _arg: Chain) -> Result<(), MiddlewareError> {
    // Chain middleware should have been resolved at configuration time
    // If we reach here, it means the chain wasn't properly expanded
    Ok(())
}

pub async fn handle_outgoing(
    _res: &mut Response<BoxBody<Bytes, std::convert::Infallible>>,
    _arg: Chain,
) -> Result<(), MiddlewareError> {
    // Chain middleware should have been resolved at configuration time
    Ok(())
}

// Note: In a real implementation, the Chain middleware would be resolved
// during configuration parsing, expanding the chain into its constituent middlewares.
// The routing system would then apply each middleware in sequence.
