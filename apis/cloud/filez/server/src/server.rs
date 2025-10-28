use anyhow::Context;
use axum::http::{
    header::{AUTHORIZATION, CONTENT_SECURITY_POLICY, CONTENT_TYPE},
    request::Parts,
    HeaderValue, Method,
};
use axum_tracing_opentelemetry::middleware::{OtelAxumLayer, OtelInResponseLayer};
use filez_server_lib::{
    background_tasks::run_background_tasks,
    config::{config, IMPERSONATE_USER_HEADER_NAME},
    database::Database,
    http_api::{self, authentication::middleware::authentication_middleware},
    kubernetes_controller,
    models::apps::MowsApp,
    state::ServerState,
    types::FilezApiDoc,
    utils::{shutdown_signal, static_as_header},
};
use mows_common_rust::{
    config::common_config, get_current_config_cloned, observability::init_observability,
};
use std::net::SocketAddr;
use tower::ServiceBuilder;
use tower_http::{
    compression::CompressionLayer,
    cors::{AllowOrigin, CorsLayer},
    decompression::DecompressionLayer,
    set_header::SetResponseHeaderLayer,
};
use tower_sessions::{cookie::time::Duration, Expiry, MemoryStore, SessionManagerLayer};
use tracing::error;
use tracing::info;
use utoipa::OpenApi;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

#[tracing::instrument(level = "trace")]
#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    let config = get_current_config_cloned!(config());
    let _common_config = get_current_config_cloned!(common_config(true));
    init_observability().await;

    let mut origins = vec![&config.primary_origin];
    if config.enable_dev {
        let _ = &config
            .dev_allow_origins
            .iter()
            .for_each(|origin| origins.push(origin));
    }

    // run pending migrations
    match Database::run_migrations().await {
        Ok(_) => info!("Migrations completed successfully"),
        Err(e) => {
            error!("Failed to run migrations: {e}");
        }
    }

    let server_state = ServerState::new(&config)
        .await
        .context("Failed to create server state")?;

    let database_for_cors_layer = server_state.database.clone();

    let session_storage_adapter = MemoryStore::default();

    let (router, api) = OpenApiRouter::with_openapi(FilezApiDoc::openapi())
        // NOTE!
        // Sometimes when something is wrong with the extractors a warning will appear of an axum version mismatch.
        // THIS IS NOT THE REASON why the error occurs.
        // often it is the order of the extractors in the route handlers
        // FILES
        .routes(routes!(http_api::files::create::create_file))
        .routes(routes!(http_api::files::get::get_files))
        .routes(routes!(http_api::files::update::update_file))
        .routes(routes!(http_api::files::delete::delete_file))
        // FILE VERSIONS
        .routes(routes!(http_api::file_versions::get::get_file_versions))
        .routes(routes!(
            http_api::file_versions::create::create_file_version
        ))
        .routes(routes!(
            http_api::file_versions::delete::delete_file_versions
        ))
        .routes(routes!(
            http_api::file_versions::update::update_file_version
        ))
        //  content
        .routes(routes!(
            http_api::file_versions::content::get::get_file_version_content
        ))
        .routes(routes!(
            http_api::file_versions::content::head::file_versions_content_tus_head
        ))
        .routes(routes!(
            http_api::file_versions::content::patch::file_versions_content_tus_patch
        ))
        // FILE GROUPS
        .routes(routes!(http_api::file_groups::create::create_file_group))
        .routes(routes!(http_api::file_groups::get::get_file_group))
        .routes(routes!(http_api::file_groups::update::update_file_group))
        .routes(routes!(http_api::file_groups::delete::delete_file_group))
        .routes(routes!(http_api::file_groups::list::list_file_groups))
        .routes(routes!(
            http_api::file_groups::list_files::list_files_in_file_group
        ))
        .routes(routes!(
            http_api::file_groups::update_members::update_file_group_members
        ))
        // APPS
        .routes(routes!(http_api::apps::get::get_apps))
        .routes(routes!(http_api::apps::list::list_apps))
        // USERS
        .routes(routes!(http_api::users::get_own::get_own_user))
        .routes(routes!(http_api::users::get::get_users))
        .routes(routes!(http_api::users::create::create_user))
        //.routes(routes!(api::users::update::update_user))
        .routes(routes!(http_api::users::delete::delete_user))
        .routes(routes!(http_api::users::list::list_users))
        // USER GROUPS
        .routes(routes!(http_api::user_groups::create::create_user_group))
        .routes(routes!(http_api::user_groups::get::get_user_groups))
        .routes(routes!(http_api::user_groups::update::update_user_group))
        .routes(routes!(http_api::user_groups::delete::delete_user_group))
        .routes(routes!(http_api::user_groups::list::list_user_groups))
        .routes(routes!(
            http_api::user_groups::list_users::list_users_by_user_group
        ))
        .routes(routes!(
            http_api::user_groups::update_members::update_user_group_members
        ))
        // ACCESS POLICIES
        .routes(routes!(
            http_api::access_policies::check_resource_access::check_resource_access
        ))
        .routes(routes!(
            http_api::access_policies::create::create_access_policy
        ))
        .routes(routes!(http_api::access_policies::get::get_access_policy))
        .routes(routes!(
            http_api::access_policies::update::update_access_policy
        ))
        .routes(routes!(
            http_api::access_policies::delete::delete_access_policy
        ))
        .routes(routes!(
            http_api::access_policies::list::list_access_policies
        ))
        // STORAGE QUOTAS
        .routes(routes!(
            http_api::storage_quotas::create::create_storage_quota
        ))
        .routes(routes!(http_api::storage_quotas::get::get_storage_quotas))
        .routes(routes!(
            http_api::storage_quotas::get_usage::get_storage_quota_usage
        ))
        .routes(routes!(
            http_api::storage_quotas::update::update_storage_quota
        ))
        .routes(routes!(
            http_api::storage_quotas::delete::delete_storage_quota
        ))
        .routes(routes!(http_api::storage_quotas::list::list_storage_quotas))
        // STORAGE LOCATIONS
        .routes(routes!(
            http_api::storage_locations::list::list_storage_locations
        ))
        // TAGS
        .routes(routes!(http_api::tags::get::get_tags))
        .routes(routes!(http_api::tags::update::update_tags))
        .routes(routes!(http_api::tags::list::list_tags))
        // JOBS
        .routes(routes!(http_api::jobs::create::create_job))
        .routes(routes!(http_api::jobs::get::get_job))
        .routes(routes!(http_api::jobs::update::update_job))
        .routes(routes!(http_api::jobs::delete::delete_job))
        .routes(routes!(http_api::jobs::list::list_jobs))
        // for apps
        .routes(routes!(http_api::jobs::apps::pickup::pickup_job))
        .routes(routes!(
            http_api::jobs::apps::update_status::update_job_status
        ))
        // HEALTH
        .routes(routes!(http_api::health::get_health))
        // SESSIONS
        .routes(routes!(http_api::sessions::start::start_session))
        .routes(routes!(http_api::sessions::end::end_session))
        // DEV
        .routes(routes!(http_api::dev::reset_database::reset_database))
        .with_state(server_state.clone())
        .layer(
            ServiceBuilder::new()
                .layer(
                    SessionManagerLayer::new(session_storage_adapter)
                        .with_secure(true)
                        .with_http_only(true)
                        .with_same_site(tower_sessions::cookie::SameSite::None)
                        .with_expiry(Expiry::OnInactivity(Duration::seconds(600))),
                )
                .layer(OtelAxumLayer::default())
                .layer(OtelInResponseLayer::default())
                .layer(axum::middleware::from_fn(
                    filez_server_lib::trace::traceparent_middleware,
                ))
                .layer(axum_server_timing::ServerTimingLayer::new("FilezService"))
                .layer(CompressionLayer::new())
                .layer(DecompressionLayer::new())
                .layer(
                    CorsLayer::new()
                        .allow_origin(AllowOrigin::async_predicate(
                            move |origin: HeaderValue, _: &Parts| async move {
                                let origin = match origin.to_str() {
                                    Ok(s) => s,
                                    Err(_) => return false,
                                };
                                if let Ok(_) = MowsApp::get_from_origin_string(
                                    &database_for_cors_layer,
                                    &origin,
                                )
                                .await
                                {
                                    return true;
                                } else {
                                    return false;
                                }
                            },
                        ))
                        .allow_methods([
                            Method::GET,
                            Method::POST,
                            Method::PUT,
                            Method::DELETE,
                            Method::PATCH,
                            Method::HEAD,
                        ])
                        .allow_credentials(true)
                        .allow_headers([
                            AUTHORIZATION,
                            CONTENT_TYPE,
                            static_as_header(IMPERSONATE_USER_HEADER_NAME),
                        ]),
                )
                .layer(SetResponseHeaderLayer::overriding(
                    CONTENT_SECURITY_POLICY,
                    HeaderValue::from_static("default-src 'none'"),
                ))
                .layer(axum::middleware::from_fn_with_state(
                    server_state.clone(),
                    authentication_middleware,
                )),
        )
        .split_for_parts();

    let router = router.merge(
        utoipa_swagger_ui::SwaggerUi::new("/swagger-ui")
            .config(utoipa_swagger_ui::Config::default().validator_url("none"))
            .url("/api-docs/openapi.json", api),
    );

    info!("Starting server");

    let listener =
        tokio::net::TcpListener::bind(SocketAddr::new("::".parse()?, config.listen_port))
            .await
            .context("Failed to bind TCP listener to address ::1:8080")?;

    let controller = kubernetes_controller::run_controller(server_state.clone());

    let server = axum::serve(
        listener,
        router.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal());

    run_background_tasks(&server_state);

    tokio::join!(controller, server).1?;

    Ok(())
}
