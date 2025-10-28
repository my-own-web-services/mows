use crate::{
    config::RUNTIME_INSTANCE_ID_HEADER_NAME,
    errors::FilezError,
    http_api::authentication::user::{handle_oidc, IntrospectedUser},
    models::{
        apps::{AppType, MowsApp},
        jobs::FilezJob,
        users::FilezUser,
    },
    state::ServerState,
};
use axum::{extract::State, middleware::Next, response::Response, Extension};
use axum_extra::{
    headers::{authorization::Bearer, Authorization},
    TypedHeader,
};

use tower_sessions::Session;
use tracing::trace;

#[derive(Clone, Debug)]
pub struct AuthenticationInformation {
    pub requesting_user: Option<FilezUser>,
    pub job: Option<FilezJob>,
    pub external_user: Option<IntrospectedUser>,
    pub requesting_app: MowsApp,
    pub requesting_app_runtime_instance_id: Option<String>,
}

#[tracing::instrument(skip(database, session), level = "trace")]
pub async fn authentication_middleware(
    State(ServerState {
        introspection_state,
        database,
        ..
    }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    maybe_bearer: Option<TypedHeader<Authorization<Bearer>>>,
    session: Session,
    mut request: axum::extract::Request,
    next: Next,
) -> Result<Response, FilezError> {
    let external_user = match maybe_bearer {
        Some(TypedHeader(Authorization(bearer))) => {
            Some(handle_oidc(bearer, &introspection_state).await?)
        }
        None => None,
    };

    trace!(
        external_user=?external_user,
        "Authentication middleware called with external user: {:?}",
        external_user
    );

    let request_headers = request.headers();
    let request_method = request.method();

    let requesting_app = MowsApp::get_from_headers(&database, &request_headers).await?;

    let mut requesting_user = FilezUser::handle_authentication(
        &database,
        &external_user,
        &request_headers,
        &request_method,
        &session,
        &requesting_app,
    )
    .await?;

    trace!(
        requesting_user=?requesting_user,
        requesting_app=?requesting_app,
        "Requesting user: {:?}, requesting app: {:?}",
        requesting_user,
        requesting_app
    );

    let (job, requesting_app_runtime_instance_id) =
        if requesting_user.is_none() && requesting_app.app_type == AppType::Backend {
            match request_headers
                .get(RUNTIME_INSTANCE_ID_HEADER_NAME)
                .and_then(|v| v.to_str().ok())
                .map(String::from)
            {
                Some(runtime_instance_id) => {
                    // If the app is a backend app, we allow it to authenticate without a user
                    let job = FilezJob::get_current_by_app_and_runtime_instance_id(
                        &database,
                        &requesting_app.id,
                        &runtime_instance_id,
                    )
                    .await?;

                    trace!(
                        runtime_instance_id=?runtime_instance_id,
                        job=?job,
                        "Backend app authenticated with runtime instance ID: {} and job: {:?}",
                        runtime_instance_id,
                        job
                    );

                    if let Some(job) = &job {
                        let user = FilezUser::get_one_by_id(&database, &job.owner_id).await?;
                        requesting_user = Some(user);

                        trace!(
                            requesting_user=?requesting_user,
                            job=?job,
                            "Job owner user found: {:?} for job: {:?}",
                            requesting_user,
                            job
                        );
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
