use crate::{
    errors::FilezError,
    http_api::authentication::user::{handle_oidc, IntrospectedUser},
    models::{
        apps::{AppType, MowsApp},
        jobs::FilezJob,
        users::FilezUser,
    },
    state::ServerState,
    with_timing,
};
use axum::{extract::State, middleware::Next, response::Response, Extension};
use axum_extra::{
    headers::{authorization::Bearer, Authorization},
    TypedHeader,
};
use tracing::debug;

#[derive(Clone)]
pub struct AuthenticationInformation {
    pub requesting_user: Option<FilezUser>,
    pub job: Option<FilezJob>,
    pub external_user: Option<IntrospectedUser>,
    pub requesting_app: MowsApp,
    pub requesting_app_runtime_instance_id: Option<String>,
}

pub async fn authentication_middleware(
    State(ServerState {
        introspection_state,
        database,
        ..
    }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    maybe_bearer: Option<TypedHeader<Authorization<Bearer>>>,
    mut request: axum::extract::Request,
    next: Next,
) -> Result<Response, FilezError> {
    let external_user = match maybe_bearer {
        Some(TypedHeader(Authorization(bearer))) => {
            Some(handle_oidc(bearer, &introspection_state).await?)
        }
        None => None,
    };

    debug!(
        "Authentication middleware called with external user: {:?}",
        external_user
    );

    let headers = request.headers();

    let (mut requesting_user, requesting_app) = with_timing!(
        tokio::try_join!(
            FilezUser::get_from_external(&database, &external_user, &headers),
            MowsApp::get_from_headers(&database, &headers)
        )?,
        "Database operations to get user and app",
        timing
    );

    let (job, requesting_app_runtime_instance_id) =
        if requesting_user.is_none() && requesting_app.app_type == AppType::Backend {
            match headers
                .get("X-Filez-Runtime-Instance-ID")
                .and_then(|v| v.to_str().ok())
                .map(String::from)
            {
                Some(runtime_instance_id) => {
                    // If the app is a backend app, we allow it to authenticate without a user
                    let job = FilezJob::get_by_app_and_runtime_instance_id(
                        &database,
                        &requesting_app.id,
                        &runtime_instance_id,
                    )
                    .await?;

                    if let Some(job) = &job {
                        let user = FilezUser::get_by_id(&database, &job.owner_id).await?;

                        requesting_user = Some(user);
                    }

                    (job, Some(runtime_instance_id))
                }
                None => {
                    return Err(FilezError::Unauthorized(
                        "Backend app requires a runtime instance ID".to_string(),
                    ));
                }
            }
        } else {
            (None, None)
        };

    // Insert the user and app into the request extensions to be used by the handler
    request.extensions_mut().insert(AuthenticationInformation {
        requesting_user,
        requesting_app,
        external_user,
        job,
        requesting_app_runtime_instance_id,
    });

    Ok(next.run(request).await)
}
