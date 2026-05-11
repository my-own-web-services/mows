//! Route registration for the filez HTTP API.
//!
//! Extracted from `src/server.rs` so that the same `OpenApiRouter` graph
//! drives both the live server and the build-time OpenAPI dump
//! (`src/bin/openapi_dump.rs`). The returned router is generic over its
//! state type; callers either inject a real `ServerState` (in the server
//! binary) or consume it directly to extract the spec (in the dump binary).
//! Layers / middleware do not contribute to the OpenAPI document and live
//! in `src/server.rs` alone.

use crate::http_api;
use crate::state::ServerState;
use crate::types::FilezApiDoc;
use utoipa::OpenApi;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

/// Build the `OpenApiRouter<ServerState>` carrying every route. Callers add
/// state and middleware on top.
pub fn build_api_router() -> OpenApiRouter<ServerState> {
    OpenApiRouter::with_openapi(FilezApiDoc::openapi())
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
            http_api::file_versions::content::head::file_versions_content_head
        ))
        .routes(routes!(
            http_api::file_versions::content::patch::file_versions_content_patch
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
        .routes(routes!(http_api::sessions::refresh::refresh_session))
        .routes(routes!(
            http_api::sessions::get_timeout::get_session_timeout
        ))
        // DEV
        .routes(routes!(http_api::dev::reset_database::reset_database))
}
