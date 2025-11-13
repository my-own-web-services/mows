use mows_common_rust::errors::MowsError;

#[derive(Debug, thiserror::Error)]
pub enum PektinServerError {
    #[error("{0}")]
    CommonError(#[from] pektin_common::PektinCommonError),
    #[error("db error")]
    DbError(#[from] pektin_common::deadpool_redis::redis::RedisError),
    #[error("could not create db connection pool: `{0}`")]
    PoolError(#[from] pektin_common::deadpool_redis::CreatePoolError),
    #[error("io error: `{0}`")]
    IoError(#[from] std::io::Error),
    #[error("could not (de)serialize JSON: `{0}`")]
    JsonError(#[from] serde_json::Error),
    #[error("invalid DNS data")]
    ProtoError(#[from] pektin_common::proto::error::ProtoError),
    #[error("data in db invalid")]
    InvalidDbData,
    #[error("requested db key had an unexpected type")]
    WickedDbValue,
    #[error("This is a bug, please report it: {0}")]
    Bug(&'static str),

    #[error(transparent)]
    MowsError(#[from] MowsError),
}
pub type PektinServerResult<T> = Result<T, PektinServerError>;
