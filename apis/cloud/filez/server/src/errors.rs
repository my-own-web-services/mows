#[derive(Debug, thiserror::Error)]

pub enum FilezErrors {
    #[error(transparent)]
    DatabaseError(#[from] diesel::result::Error),
    #[error(transparent)]
    DeadpoolError(#[from] diesel_async::pooled_connection::deadpool::PoolError),
    #[error("Auth Evaluation Error: {0}")]
    AuthEvaluationError(String),
    #[error(transparent)]
    UrlParseError(#[from] url::ParseError),
}
