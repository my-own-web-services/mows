use crate::{
    errors::FilezError,
    models::{apps::MowsApp, users::FilezUser},
    state::ServerState,
    with_timing,
};
use axum::{extract::State, middleware::Next, response::Response};
use zitadel::axum::introspection::IntrospectedUser;

#[derive(Clone)]
pub struct AuthenticatedUserAndApp {
    pub requesting_user: FilezUser,
    pub requesting_app: MowsApp,
}

pub async fn auth_middleware(
    State(state): State<ServerState>,
    mut req: axum::extract::Request,
    next: Next,
) -> Result<Response, FilezError> {
    let external_user = req.extensions().get::<IntrospectedUser>().unwrap();
    let timing = req
        .extensions()
        .get::<axum_server_timing::ServerTimingExtension>()
        .unwrap();

    let headers = req.headers();

    let (user, app) = with_timing!(
        tokio::try_join!(
            FilezUser::get_from_external(&state.database, &external_user, &headers),
            MowsApp::get_from_headers(&state.database, &headers)
        )?,
        "Database operations to get user and app",
        timing
    );

    // Insert the user and app into the request extensions to be used by the handler
    req.extensions_mut().insert(AuthenticatedUserAndApp {
        requesting_user: user,
        requesting_app: app,
    });

    Ok(next.run(req).await)
}
