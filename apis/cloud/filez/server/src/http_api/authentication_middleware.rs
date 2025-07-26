use crate::{
    errors::FilezError,
    models::{apps::MowsApp, users::FilezUser},
    state::ServerState,
    with_timing,
};
use axum::{extract::State, middleware::Next, response::Response};
use zitadel::axum::introspection::IntrospectedUser;

#[derive(Clone)]
pub struct AuthenticationInformation {
    pub requesting_user: Option<FilezUser>,
    pub requesting_app: MowsApp,
}

pub async fn auth_middleware(
    State(state): State<ServerState>,
    mut request: axum::extract::Request,
    next: Next,
) -> Result<Response, FilezError> {
    let external_user = request.extensions().get::<IntrospectedUser>().unwrap();
    let timing = request
        .extensions()
        .get::<axum_server_timing::ServerTimingExtension>()
        .unwrap();

    let headers = request.headers();

    let (requesting_user, requesting_app) = with_timing!(
        tokio::try_join!(
            FilezUser::get_from_external(&state.database, &external_user, &headers),
            MowsApp::get_from_headers(&state.database, &headers)
        )?,
        "Database operations to get user and app",
        timing
    );

    // Insert the user and app into the request extensions to be used by the handler
    request.extensions_mut().insert(AuthenticationInformation {
        requesting_user,
        requesting_app,
    });

    Ok(next.run(request).await)
}
