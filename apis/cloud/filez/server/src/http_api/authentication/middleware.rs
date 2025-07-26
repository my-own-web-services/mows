use crate::{
    errors::FilezError,
    http_api::authentication::user::{handle_oidc, IntrospectedUser},
    models::{apps::MowsApp, users::FilezUser},
    state::ServerState,
    with_timing,
};
use axum::{extract::State, middleware::Next, response::Response, Extension};
use axum_extra::{
    headers::{authorization::Bearer, Authorization},
    TypedHeader,
};

#[derive(Clone)]
pub struct AuthenticationInformation {
    pub requesting_user: Option<FilezUser>,
    pub external_user: Option<IntrospectedUser>,
    pub requesting_app: MowsApp,
}

pub async fn auth_middleware(
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

    let headers = request.headers();

    let (requesting_user, requesting_app) = with_timing!(
        tokio::try_join!(
            FilezUser::get_from_external(&database, &external_user, &headers),
            MowsApp::get_from_headers(&database, &headers)
        )?,
        "Database operations to get user and app",
        timing
    );

    // Insert the user and app into the request extensions to be used by the handler
    request.extensions_mut().insert(AuthenticationInformation {
        requesting_user,
        requesting_app,
        external_user,
    });

    Ok(next.run(request).await)
}
