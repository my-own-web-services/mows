use crate::{
    database::Database,
    errors::FilezError,
    http_api::jobs::list::ListJobsSortBy,
    impl_typed_uuid,
    models::{
        apps::{MowsApp, MowsAppId},
        files::FilezFileId,
        storage_locations::StorageLocationId,
        storage_quotas::StorageQuotaId,
        users::{FilezUser, FilezUserId},
    },
    schema::{self},
    types::SortDirection,
    utils::{get_current_timestamp, InvalidEnumType},
};
use chrono::NaiveDateTime;
use diesel::{
    deserialize::FromSqlRow, expression::AsExpression, pg::Pg, prelude::*, sql_types::SmallInt,
    AsChangeset,
};
use diesel_as_jsonb::AsJsonb;
use diesel_async::RunQueryDsl;
use diesel_enum::DbEnum;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use serde_valid::Validate;
use std::collections::HashMap;
use tracing::{error, trace};
use utoipa::ToSchema;

#[derive(
    Debug,
    Clone,
    Copy,
    PartialEq,
    Eq,
    AsExpression,
    FromSqlRow,
    DbEnum,
    Serialize,
    Deserialize,
    ToSchema,
)]
#[diesel(sql_type = SmallInt)]
#[diesel_enum(error_fn = InvalidEnumType::invalid_type_log)]
#[diesel_enum(error_type = InvalidEnumType)]
pub enum JobPersistenceType {
    /// The job is temporary and will be marked finished after a certain time or when it is completed
    Temporary = 0,
    /// The job is ongoing and will not be marked finished until removed by the user
    Persistent = 1,
}

impl_typed_uuid!(FilezJobId);

#[derive(
    Queryable,
    Selectable,
    Clone,
    Insertable,
    Debug,
    QueryableByName,
    Serialize,
    Deserialize,
    ToSchema,
    AsChangeset,
)]
#[diesel(table_name = schema::jobs)]
#[diesel(check_for_backend(Pg))]
#[diesel(treat_none_as_null = true)]
pub struct FilezJob {
    pub id: FilezJobId,
    pub owner_id: FilezUserId,
    /// The app that should handle the job
    pub app_id: MowsAppId,
    /// After the job is picked up by the app, this field will be set to the app instance id, created from the kubernetes pod UUID and a random string that the app generates on startup
    pub assigned_app_runtime_instance_id: Option<String>,
    /// The last time the app instance has been seen by the server
    /// This is used to determine if the app instance is still alive and can handle the job
    pub app_instance_last_seen_time: Option<chrono::NaiveDateTime>,
    pub name: String,
    /// The current status of the job
    pub status: JobStatus,

    pub status_details: Option<JobStatusDetails>,
    /// Details relevant for the execution of the job
    pub execution_information: JobExecutionInformation,
    pub persistence: JobPersistenceType,
    /// When the job was created in the database
    pub created_time: chrono::NaiveDateTime,
    /// When the job was last modified in the database
    pub modified_time: chrono::NaiveDateTime,
    /// When the job was started, either automatically or manually
    pub start_time: Option<chrono::NaiveDateTime>,
    /// When the job was finished, either successfully or failed
    pub end_time: Option<chrono::NaiveDateTime>,
    /// After the deadline the job will be marked as finished and failed if not completed
    pub deadline_time: Option<chrono::NaiveDateTime>,
}

#[derive(Serialize, Deserialize, AsChangeset, Validate, ToSchema, Clone, Debug)]
#[diesel(table_name = schema::jobs)]
pub struct UpdateJobChangeset {
    #[schema(max_length = 256)]
    #[validate(max_length = 256)]
    #[diesel(column_name = name)]
    pub new_job_name: Option<String>,
    #[diesel(column_name = execution_information)]
    pub new_job_execution_information: Option<JobExecutionInformation>,
    #[diesel(column_name = persistence)]
    pub new_job_persistence: Option<JobPersistenceType>,
    #[diesel(column_name = deadline_time)]
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        with = "::serde_with::rust::double_option"
    )]
    pub new_job_deadline_time: Option<Option<NaiveDateTime>>,
}

#[derive(
    Debug,
    Clone,
    Copy,
    PartialEq,
    Eq,
    AsExpression,
    FromSqlRow,
    DbEnum,
    Serialize,
    Deserialize,
    ToSchema,
)]
#[diesel(sql_type = SmallInt)]
#[diesel_enum(error_fn = InvalidEnumType::invalid_type_log)]
#[diesel_enum(error_type = InvalidEnumType)]
pub enum JobStatus {
    /// The job is created and waiting to be picked up by the app
    Created = 0,
    /// The job is currently being processed by the app
    InProgress = 1,
    /// The job was successfully completed by the app
    Completed = 2,
    /// The job failed to be processed by the app
    Failed = 3,
    /// The job was cancelled by the user or the system
    Cancelled = 4,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, AsJsonb)]
pub enum JobStatusDetails {
    Created(JobStatusDetailsCreated),
    InProgress(JobStatusDetailsInProgress),
    Completed(JobStatusDetailsCompleted),
    Failed(JobStatusDetailsFailed),
    Cancelled(JobStatusDetailsCancelled),
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct JobStatusDetailsCreated {
    pub message: String,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct JobStatusDetailsInProgress {
    pub message: String,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct JobStatusDetailsCompleted {
    pub message: String,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct JobStatusDetailsFailed {
    pub message: String,
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct JobStatusDetailsCancelled {
    pub message: String,
    pub reason: Option<String>,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, AsJsonb)]
pub struct JobExecutionInformation {
    pub job_type: JobType,
}

#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub enum JobType {
    CreatePreview(JobTypeCreatePreview),
}

/// Allows the app to create a set of previews for a existing file_version_number and file_id
#[derive(Serialize, Deserialize, ToSchema, Clone, Debug, Validate)]
pub struct JobTypeCreatePreview {
    pub file_id: FilezFileId,
    pub file_version_number: u32,
    pub storage_location_id: StorageLocationId,
    pub storage_quota_id: StorageQuotaId,
    pub allowed_size_bytes: u64,
    pub allowed_number_of_previews: u32,
    pub allowed_mime_types: Vec<String>,
    #[schema(value_type = Object)]
    pub preview_config: Value,
}

impl FilezJob {
    #[tracing::instrument(level = "trace")]
    pub fn new(
        owner_id: FilezUserId,
        app_id: MowsAppId,
        name: String,
        execution_details: JobExecutionInformation,
        persistence: JobPersistenceType,
        deadline_time: Option<chrono::NaiveDateTime>,
    ) -> Self {
        Self {
            id: FilezJobId::new(),
            owner_id,
            app_id,
            assigned_app_runtime_instance_id: None,
            app_instance_last_seen_time: None,
            name,
            status: JobStatus::Created,
            status_details: None,
            execution_information: execution_details,
            persistence,
            created_time: get_current_timestamp(),
            modified_time: get_current_timestamp(),
            start_time: None,
            end_time: None,
            deadline_time,
        }
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn create_one(
        database: &Database,
        owner_id: FilezUserId,
        app_id: MowsAppId,
        name: String,
        execution_details: JobExecutionInformation,
        persistence: JobPersistenceType,
        deadline_time: Option<chrono::NaiveDateTime>,
    ) -> Result<FilezJob, FilezError> {
        let job = FilezJob::new(
            owner_id,
            app_id,
            name,
            execution_details,
            persistence,
            deadline_time,
        );
        let mut connection = database.get_connection().await?;

        let created_job = diesel::insert_into(schema::jobs::table)
            .values(&job)
            .returning(FilezJob::as_returning())
            .get_result::<FilezJob>(&mut connection)
            .await?;

        Ok(created_job)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn release_jobs(
        database: &Database,
        release_after_seconds: u64,
    ) -> Result<(), FilezError> {
        // release all jobs that have an app instance assigned but have not been seen since the last `release_after_seconds` seconds, update them directly
        let mut connection = database.get_connection().await?;
        let release_time =
            get_current_timestamp() - chrono::Duration::seconds(release_after_seconds as i64);

        let released_jobs = diesel::update(schema::jobs::table)
            .filter(schema::jobs::assigned_app_runtime_instance_id.is_not_null())
            .filter(schema::jobs::app_instance_last_seen_time.lt(release_time))
            .set((
                schema::jobs::status.eq(JobStatus::Created),
                schema::jobs::status_details.eq(Some(JobStatusDetails::Created(
                    JobStatusDetailsCreated {
                        message: "Job has been released due to inactivity and is waiting to be picked up again".to_string(),
                    },
                ))),
                schema::jobs::end_time.eq(Some(get_current_timestamp())),
                schema::jobs::assigned_app_runtime_instance_id.eq(None::<String>),
                schema::jobs::app_instance_last_seen_time.eq(None::<NaiveDateTime>),
            ))
            .execute(&mut connection)
            .await?;
        trace!(
            "Released {} jobs that were inactive for more than {} seconds",
            released_jobs,
            release_after_seconds
        );
        Ok(())
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn get_many_by_id(
        database: &Database,
        job_ids: &[FilezJobId],
    ) -> Result<HashMap<FilezJobId, FilezJob>, FilezError> {
        let mut connection = database.get_connection().await?;
        let jobs = schema::jobs::table
            .filter(schema::jobs::id.eq_any(job_ids))
            .load::<FilezJob>(&mut connection)
            .await?;
        Ok(jobs.into_iter().map(|job| (job.id, job)).collect())
    }

    #[tracing::instrument(level = "trace", skip(database, requesting_user, requesting_app))]
    pub async fn list(
        database: &Database,
        requesting_user: Option<&FilezUser>,
        requesting_app: &MowsApp,
        from_index: Option<u64>,
        limit: Option<u64>,
        sort_by: Option<ListJobsSortBy>,
        sort_order: Option<SortDirection>,
    ) -> Result<Vec<FilezJob>, FilezError> {
        let mut connection = database.get_connection().await?;
        let mut query = schema::jobs::table.into_boxed();

        if let Some(user) = requesting_user {
            query = query.filter(schema::jobs::owner_id.eq(user.id));
        } else {
            query = query.filter(schema::jobs::app_id.eq(requesting_app.id));
        }

        if let Some(from) = from_index {
            query = query.offset(from as i64);
        }

        if let Some(lim) = limit {
            query = query.limit(lim as i64);
        }

        let order = sort_order.unwrap_or(SortDirection::Ascending);
        let sort = sort_by.unwrap_or(ListJobsSortBy::CreatedTime);

        match order {
            SortDirection::Ascending => match sort {
                ListJobsSortBy::Name => query = query.order(schema::jobs::name.asc()),
                ListJobsSortBy::CreatedTime => {
                    query = query.order(schema::jobs::created_time.asc())
                }
                ListJobsSortBy::ModifiedTime => {
                    query = query.order(schema::jobs::modified_time.asc())
                }
            },
            SortDirection::Descending => match sort {
                ListJobsSortBy::Name => query = query.order(schema::jobs::name.desc()),
                ListJobsSortBy::CreatedTime => {
                    query = query.order(schema::jobs::created_time.desc())
                }
                ListJobsSortBy::ModifiedTime => {
                    query = query.order(schema::jobs::modified_time.desc())
                }
            },
        }

        let jobs = query.load::<FilezJob>(&mut connection).await?;
        Ok(jobs)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn delete_one(database: &Database, job_id: FilezJobId) -> Result<(), FilezError> {
        let mut connection = database.get_connection().await?;
        diesel::delete(schema::jobs::table.find(job_id))
            .execute(&mut connection)
            .await?;
        Ok(())
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn get_by_id(
        database: &Database,
        job_id: FilezJobId,
    ) -> Result<FilezJob, FilezError> {
        let mut connection = database.get_connection().await?;
        let job = schema::jobs::table
            .find(job_id)
            .get_result::<FilezJob>(&mut connection)
            .await?;
        Ok(job)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn delete_by_id(database: &Database, job_id: FilezJobId) -> Result<(), FilezError> {
        let mut connection = database.get_connection().await?;
        diesel::delete(schema::jobs::table.find(job_id))
            .execute(&mut connection)
            .await?;
        Ok(())
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn get_current_by_app_and_runtime_instance_id(
        database: &Database,
        app_id: &MowsAppId,
        runtime_instance_id: &str,
    ) -> Result<Option<FilezJob>, FilezError> {
        let mut connection = database.get_connection().await?;
        let jobs = schema::jobs::table
            .filter(schema::jobs::app_id.eq(app_id))
            .filter(schema::jobs::assigned_app_runtime_instance_id.eq(runtime_instance_id))
            .limit(2)
            .load::<FilezJob>(&mut connection)
            .await?;

        if jobs.len() > 1 {
            error!(
                app_id=?app_id,
                runtime_instance_id=?runtime_instance_id,
                jobs=?jobs,
                "FATAL ERROR: Database inconsistency: Found multiple jobs for app_id: {} and runtime_instance_id: {}",
                app_id, runtime_instance_id
            );
        }

        Ok(jobs.into_iter().next())
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn update_one(
        database: &Database,
        job_id: FilezJobId,
        changeset: UpdateJobChangeset,
    ) -> Result<FilezJob, FilezError> {
        let mut connection = database.get_connection().await?;
        let updated_job = diesel::update(schema::jobs::table.find(job_id))
            .set((
                changeset,
                schema::jobs::modified_time.eq(get_current_timestamp()),
            ))
            .get_result::<FilezJob>(&mut connection)
            .await?;

        trace!(
            job_id=?updated_job.id,
            job_status=?updated_job.status,
            updated_job=?updated_job,
            "Job updated successfully"
        );

        Ok(updated_job)
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn pickup_one(
        database: &Database,
        app: MowsApp,
        app_runtime_instance_id: Option<String>,
    ) -> Result<Option<FilezJob>, FilezError> {
        trace!(
            "Attempting to pick up a job for app: {:?} with runtime instance ID: {:?}",
            app,
            app_runtime_instance_id
        );

        let app_runtime_instance_id = app_runtime_instance_id.ok_or(FilezError::InvalidRequest(
            "App runtime instance ID is required for job pickup".to_string(),
        ))?;

        if app.app_type != crate::models::apps::AppType::Backend {
            error!(
                app_id=?app.id,
                app_runtime_instance_id=?app_runtime_instance_id,
                "Unauthorized job pickup attempt by app: {:?} with runtime instance ID: {:?}",
                app, app_runtime_instance_id
            );
            return Err(FilezError::Unauthorized(
                "Only backend apps can pick up jobs".to_string(),
            ));
        }

        // check if the app has a job already assigned
        let existing_job = FilezJob::get_current_by_app_and_runtime_instance_id(
            database,
            &app.id,
            &app_runtime_instance_id,
        )
        .await?;

        if existing_job.is_some_and(|job| job.status == JobStatus::InProgress) {
            error!(
                app_id=?app.id,
                app_runtime_instance_id=?app_runtime_instance_id,
                "Job pickup failed: App already has a job with status InProgress assigned"
            );
            return Err(FilezError::InvalidRequest(
                "App already has a job with status InProgress assigned".to_string(),
            ));
        }

        let mut connection = database.get_connection().await?;

        let job_result = connection
            .build_transaction()
            .serializable()
            .run(|connection| {
                Box::pin(async move {
                    let job = schema::jobs::table
                        .filter(schema::jobs::app_id.eq(app.id))
                        .filter(schema::jobs::assigned_app_runtime_instance_id.is_null())
                        .filter(schema::jobs::status.eq(JobStatus::Created))
                        .order(schema::jobs::created_time.asc())
                        .for_update() // Lock the selected row(s).
                        .first::<FilezJob>(connection)
                        .await
                        .optional()?;

                    trace!(
                        "Job pickup attempt for app: {:?} with runtime instance ID: {:?}, found job: {:?}",
                        app, app_runtime_instance_id, job
                    );

                    if let Some(mut job) = job {
                        job.assigned_app_runtime_instance_id = Some(app_runtime_instance_id.clone());
                        job.app_instance_last_seen_time = Some(get_current_timestamp());
                        job.status = JobStatus::InProgress;
                        job.start_time = Some(get_current_timestamp());
                        job.status_details =
                            Some(JobStatusDetails::InProgress(JobStatusDetailsInProgress {
                                message: "Job has been picked up and is now in progress"
                                    .to_string(),
                            }));

                        let updated_job = diesel::update(schema::jobs::table.find(job.id))
                            .set(&job)
                            .get_result::<FilezJob>(connection)
                            .await?;

                        trace!(
                            app_id=?app.id,
                            app_runtime_instance_id=?app_runtime_instance_id,
                            updated_job=?updated_job,
                            "Job successfully updated for app: {:?} with runtime instance ID: {:?}, updated job: {:?}",
                            app, app_runtime_instance_id, updated_job
                        );

                        Ok(Some(updated_job))
                    } else {
                        Ok(None)
                    }
                })
            })
            .await;

        job_result
    }

    #[tracing::instrument(level = "trace", skip(database))]
    pub async fn update_status(
        database: &Database,
        app: MowsApp,
        app_runtime_instance_id: String,
        new_status: JobStatus,
        new_status_details: Option<JobStatusDetails>,
    ) -> Result<FilezJob, FilezError> {
        trace!(
            "Updating job status for app: {:?} with runtime instance ID: {:?}",
            app,
            app_runtime_instance_id
        );

        let mut connection = database.get_connection().await?;

        let updated_job = connection
            .build_transaction()
            .serializable()
            .run(|conn| {
                Box::pin(async move {
                    let job = schema::jobs::table
                        .filter(schema::jobs::app_id.eq(app.id))
                        .filter(
                            schema::jobs::assigned_app_runtime_instance_id
                                .eq(&app_runtime_instance_id),
                        )
                        .first::<FilezJob>(conn)
                        .await?;

                    if job.status != JobStatus::InProgress {
                        error!(
                            job_id=?job.id,
                            current_status=?job.status,
                            "Job status update failed: Job is not in progress, current status: {:?}",
                            job.status
                        );
                        return Err(FilezError::InvalidRequest(format!(
                            "Job status can only be updated if the job is in progress, current status: {:?}",
                            job.status
                        )));
                    }

                    let mut updated_job = job.clone();

                    if new_status == JobStatus::Completed || new_status == JobStatus::Failed {
                        updated_job.end_time = Some(get_current_timestamp());
                    } else {
                        error!(
                            job_id=?updated_job.id,
                            new_status=?new_status,
                            "Job status update failed: New status is not Completed or Failed, new status: {:?}",
                            new_status
                        );
                        return Err(FilezError::InvalidRequest(
                            "Job status can only be updated to Completed or Failed".to_string(),
                        ));
                    }

                    updated_job.status = new_status;
                    updated_job.status_details = new_status_details;
                    updated_job.modified_time = get_current_timestamp();
                    updated_job.app_instance_last_seen_time = Some(get_current_timestamp());
                    updated_job.assigned_app_runtime_instance_id = None;

                    let updated_job = diesel::update(schema::jobs::table.find(updated_job.id))
                        .set(&updated_job)
                        .get_result::<FilezJob>(conn)
                        .await?;

                    trace!(
                        job_id=?updated_job.id,
                        job_status=?updated_job.status,
                        "Job status updated successfully for job ID: {:?}, job status: {:?}",
                        updated_job.id, updated_job.status
                    );

                    Ok(updated_job)
                })
            })
            .await?;

        Ok(updated_job)
    }
}
