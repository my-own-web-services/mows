use crate::{
    config::RUNTIME_INSTANCE_ID_HEADER_NAME,
    errors::FilezError,
    http_api::authentication::user::introspection_error_into_filez,
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
use mows_auth_core::{IntrospectedUser, IntrospectionResult};

use tower_sessions::Session;
use tracing::trace;

#[derive(Clone, Debug)]
pub struct AuthenticationInformation {
    pub requesting_user: Option<FilezUser>,
    pub job: Option<FilezJob>,
    /// The verified introspection result for the bearer token (engine
    /// type — fields: sub, name, email, email_verified, locale, extra).
    /// Downstream handlers that need IdP-specific claims pull them out
    /// of `extra` by JSON path.
    pub external_user: Option<IntrospectedUser>,
    pub requesting_app: MowsApp,
    pub requesting_app_runtime_instance_id: Option<String>,
}

#[tracing::instrument(skip(database, session, introspector), level = "trace")]
pub async fn authentication_middleware(
    State(ServerState {
        introspector,
        database,
        ..
    }): State<ServerState>,
    Extension(timing): Extension<axum_server_timing::ServerTimingExtension>,
    maybe_bearer: Option<TypedHeader<Authorization<Bearer>>>,
    session: Session,
    mut request: axum::extract::Request,
    next: Next,
) -> Result<Response, FilezError> {
    // Directly call the engine introspector; map the engine error
    // type to FilezError at this single point.
    let introspector_idp_id = introspector.idp_id();
    let introspection_result: Option<IntrospectionResult> = match maybe_bearer {
        Some(TypedHeader(Authorization(bearer))) => {
            let result = introspector
                .introspect(bearer.token())
                .await
                .map_err(introspection_error_into_filez)?;
            if !result.active {
                return Err(introspection_error_into_filez(
                    mows_auth_core::IntrospectionError::Inactive,
                ));
            }
            Some(result)
        }
        None => None,
    };

    // Filez handlers still require a user — Client Credentials grants
    // (user: None) get rejected at the auth boundary the same way the
    // old handle_oidc did. The IntrospectionResult itself is retained
    // for the client_id-based app lookup below.
    let external_user: Option<IntrospectedUser> = match &introspection_result {
        Some(result) => Some(result.user.clone().ok_or_else(|| {
            FilezError::IntrospectionGuardError(
                crate::http_api::authentication::user::IntrospectionGuardError::NoUserId,
            )
        })?),
        None => None,
    };

    trace!(
        external_user=?external_user,
        "Authentication middleware called with external user: {:?}",
        external_user
    );

    let request_headers = request.headers();
    let request_method = request.method();

    // AUTHENTICATION.md §4.2 + §8: prefer the `(idp_id,
    // external_client_id)` composite from the introspected token over
    // the Origin / SA-token path. Origin lookup remains as the
    // documented fallback for the migration window — first-party apps
    // whose Zitadel registration row hasn't been backfilled yet still
    // resolve via Origin, and anonymous requests (no bearer token)
    // still land on the sentinel `no-origin` app.
    let requesting_app = match &introspection_result {
        Some(result) => match MowsApp::get_by_idp_and_external_client_id(
            &database,
            &introspector_idp_id,
            &result.client_id,
        )
        .await?
        {
            Some(app) => {
                trace!(
                    client_id = %result.client_id,
                    app_id = %app.id,
                    "Resolved requesting_app by (idp_id, external_client_id)"
                );
                app
            }
            None => {
                trace!(
                    client_id = %result.client_id,
                    "No app row for (idp_id, external_client_id) — falling back to header-based lookup"
                );
                MowsApp::get_from_headers(&database, &request_headers).await?
            }
        },
        None => MowsApp::get_from_headers(&database, &request_headers).await?,
    };

    let mut requesting_user = FilezUser::handle_authentication(
        &database,
        introspector_idp_id,
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
