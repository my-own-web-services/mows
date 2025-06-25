use crate::{
    storage::{
        errors::StorageError,
        location::StorageLocation,
        state::{StorageLocationsState, StorageProvider},
    },
    utils::{get_uuid, InvalidEnumType},
};
use axum::body::Body;
use bigdecimal::BigDecimal;
use diesel::{
    deserialize::FromSqlRow, expression::AsExpression, pg::Pg, prelude::*, sql_types::Text,
};
use diesel_as_jsonb::AsJsonb;
use diesel_enum::DbEnum;
use mime_guess::Mime;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(
    Serialize,
    Deserialize,
    Queryable,
    Selectable,
    ToSchema,
    Insertable,
    Clone,
    QueryableByName,
    Debug,
)]
#[diesel(table_name = crate::schema::files)]
#[diesel(check_for_backend(Pg))]
pub struct File {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub mime_type: String,
    pub name: String,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
    #[schema(value_type=i64)]
    pub size: BigDecimal,
    pub metadata: FileMetadata,
    pub storage: StorageLocation,
    pub sha256_digest: Option<String>,
}

#[derive(Serialize, Deserialize, AsJsonb, ToSchema, Clone, Debug)]
pub struct FileMetadata {
    /// Place for apps to store custom data related to the file.
    /// every app is identified by its id, and can only access its own data.
    pub private_app_data: HashMap<String, serde_json::Value>,
    /// Apps can provide and request shared app data from other apps on creation
    pub shared_app_data: HashMap<String, serde_json::Value>,
    /// Extracted data from the file, such as text content, metadata, etc.
    pub extracted_data: serde_json::Value,
    pub default_preview_app_id: Option<Uuid>,
}

impl FileMetadata {
    pub fn new() -> Self {
        Self {
            private_app_data: HashMap::new(),
            shared_app_data: HashMap::new(),
            extracted_data: serde_json::Value::Null,
            default_preview_app_id: None,
        }
    }
}

impl File {
    pub fn new(
        owner: &User,
        mime_type: &Mime,
        file_name: &str,
        size: u64,
        sha256_digest: Option<String>,
    ) -> Self {
        Self {
            id: get_uuid(),
            owner_id: owner.id.clone(),
            mime_type: mime_type.to_string(),
            name: file_name.to_string(),
            created_time: chrono::Utc::now().naive_utc(),
            modified_time: chrono::Utc::now().naive_utc(),
            size: size.try_into().unwrap(),
            metadata: FileMetadata::new(),
            storage: StorageLocation::default(),
            sha256_digest,
        }
    }

    pub async fn get_storage_provider_id_for_app_id(
        &self,
        app_id: &Uuid,
    ) -> Result<Uuid, StorageError> {
        self.storage
            .locations
            .get(&app_id)
            .ok_or(StorageError::StorageProviderForAppNotFound(
                app_id.to_string(),
            ))
            .copied()
    }

    pub async fn get_content(
        &self,
        storage_provider_state: StorageLocationsState,
        timing: axum_server_timing::ServerTimingExtension,
        range: Option<(Option<u64>, Option<u64>)>,
        app_id: Option<Uuid>,
        app_path: Option<String>,
    ) -> Result<Body, StorageError> {
        let provider_id = self
            .get_storage_provider_id_for_app_id(&app_id.unwrap_or(Uuid::default()))
            .await?;

        let providers = storage_provider_state.providers.read().await;

        match providers.get(&provider_id) {
            Some(provider_state) => match provider_state {
                StorageProvider::Minio(minio_provider) => {
                    minio_provider
                        .get_content(self, timing, range, app_path)
                        .await
                }
            },
            None => {
                return Err(StorageError::StorageProviderStateNotFound(
                    provider_id.to_string(),
                ))
            }
        }
    }

    pub async fn create_file(
        &self,
        storage_provider_state: StorageLocationsState,
        request: axum::http::Request<axum::body::Body>,
        timing: axum_server_timing::ServerTimingExtension,
        sha256_digest: Option<String>,
    ) -> Result<(), StorageError> {
        let provider_id = self
            .get_storage_provider_id_for_app_id(&Uuid::default())
            .await?;

        let providers = storage_provider_state.providers.read().await;

        match providers.get(&provider_id) {
            Some(provider_state) => match provider_state {
                StorageProvider::Minio(minio_provider) => {
                    minio_provider
                        .create_file(self, request, timing, sha256_digest)
                        .await
                }
            },
            None => {
                return Err(StorageError::StorageProviderStateNotFound(
                    provider_id.to_string(),
                ))
            }
        }
    }
}

#[derive(Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Insertable, Debug)]
#[diesel(table_name = crate::schema::users)]
#[diesel(check_for_backend(Pg))]
pub struct User {
    pub id: Uuid,
    pub external_user_id: Option<String>,
    pub display_name: String,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
    pub deleted: bool,
    #[schema(value_type=i64)]
    pub storage_limit: BigDecimal,
}

impl User {
    pub fn new(external_user_id: Option<String>, display_name: &str, storage_limit: i64) -> Self {
        Self {
            id: get_uuid(),
            external_user_id,
            display_name: display_name.to_string(),
            created_time: chrono::Utc::now().naive_utc(),
            modified_time: chrono::Utc::now().naive_utc(),
            deleted: false,
            storage_limit: BigDecimal::from(storage_limit),
        }
    }
}

#[derive(Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Insertable, Debug)]
#[diesel(table_name = crate::schema::file_groups)]
#[diesel(check_for_backend(Pg))]
pub struct FileGroup {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub name: String,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
}

impl FileGroup {
    pub fn new(owner: &User, name: &str) -> Self {
        Self {
            id: get_uuid(),
            owner_id: owner.id.clone(),
            name: name.to_string(),
            created_time: chrono::Utc::now().naive_utc(),
            modified_time: chrono::Utc::now().naive_utc(),
        }
    }
}

#[derive(
    Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Associations, Insertable, Debug,
)]
#[diesel(table_name = crate::schema::file_file_group_members)]
#[diesel(belongs_to(File, foreign_key = file_id))]
#[diesel(belongs_to(FileGroup, foreign_key = file_group_id))]
#[diesel(primary_key(file_id, file_group_id))]
#[diesel(check_for_backend(Pg))]
pub struct FileFileGroupMember {
    pub file_id: Uuid,
    pub file_group_id: Uuid,
    pub created_time: chrono::NaiveDateTime,
}

impl FileFileGroupMember {
    pub fn new(file_id: Uuid, file_group_id: Uuid) -> Self {
        Self {
            file_id,
            file_group_id,
            created_time: chrono::Utc::now().naive_utc(),
        }
    }
}

#[derive(Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Debug, Insertable)]
#[diesel(table_name = crate::schema::file_groups)]
#[diesel(check_for_backend(Pg))]
pub struct UserGroup {
    pub id: Uuid,
    pub owner_id: Uuid,
    pub name: String,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
}

impl UserGroup {
    pub fn new(owner: &User, name: &str) -> Self {
        Self {
            id: get_uuid(),
            owner_id: owner.id.clone(),
            name: name.to_string(),
            created_time: chrono::Utc::now().naive_utc(),
            modified_time: chrono::Utc::now().naive_utc(),
        }
    }
}

#[derive(
    Serialize, Deserialize, Queryable, Selectable, ToSchema, Clone, Associations, Insertable, Debug,
)]
#[diesel(table_name = crate::schema::user_user_group_members)]
#[diesel(belongs_to(File, foreign_key = user_id))]
#[diesel(belongs_to(FileGroup, foreign_key = user_group_id))]
#[diesel(primary_key(user_id, user_group_id))]
#[diesel(check_for_backend(Pg))]
pub struct UserUserGroupMember {
    pub user_id: Uuid,
    pub user_group_id: Uuid,
    pub created_time: chrono::NaiveDateTime,
}

impl UserUserGroupMember {
    pub fn new(user_id: Uuid, user_group_id: Uuid) -> Self {
        Self {
            user_id,
            user_group_id,
            created_time: chrono::Utc::now().naive_utc(),
        }
    }
}

#[derive(
    Debug, Clone, Copy, PartialEq, Eq, AsExpression, FromSqlRow, DbEnum, Serialize, Deserialize,
)]
#[diesel(sql_type = Text)]
#[diesel_enum(error_fn = InvalidEnumType::invalid_type_log)]
#[diesel_enum(error_type = InvalidEnumType)]
pub enum AccessPolicySubjectType {
    User,
    UserGroup,
}

#[derive(
    Debug, Serialize, Clone, Copy, PartialEq, Eq, AsExpression, FromSqlRow, DbEnum, Deserialize,
)]
#[diesel(sql_type = Text)]
#[diesel_enum(error_fn = InvalidEnumType::invalid_type_log)]
#[diesel_enum(error_type = InvalidEnumType)]
pub enum AccessPolicyResourceType {
    File,
    FileGroup,
    User,
    UserGroup,
}

#[derive(
    Debug, Serialize, Clone, Copy, PartialEq, Eq, AsExpression, FromSqlRow, DbEnum, Deserialize,
)]
#[diesel(sql_type = Text)]
#[diesel_enum(error_fn = InvalidEnumType::invalid_type_log)]
#[diesel_enum(error_type = InvalidEnumType)]
pub enum AccessPolicyEffect {
    Deny,
    Allow,
}

#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq, Deserialize)]
pub enum AccessPolicyAction {
    #[serde(rename = "filez.files.content.get")]
    FilesContentGet,
    #[serde(rename = "filez.files.meta.get")]
    FilesMetaGet,
    #[serde(rename = "filez.files.meta.list")]
    FilesMetaList,
    #[serde(rename = "filez.files.meta.update")]
    FilesMetaUpdate,
    #[serde(rename = "filez.users.get")]
    UsersGet,
    #[serde(rename = "filez.file_groups.list_items")]
    FileGroupListItems,
}

#[derive(Queryable, Selectable, Clone, Insertable, Debug, QueryableByName)]
#[diesel(check_for_backend(Pg))]
#[diesel(table_name = crate::schema::access_policies)]
pub struct AccessPolicy {
    pub id: Uuid,
    pub name: String,

    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,

    #[diesel(sql_type = diesel::sql_types::Text)]
    pub subject_type: AccessPolicySubjectType,
    pub subject_id: Uuid,

    pub context_app_id: Option<String>,

    #[diesel(sql_type = diesel::sql_types::Text)]
    pub resource_type: AccessPolicyResourceType,
    pub resource_id: Uuid,

    pub action: String,

    pub effect: AccessPolicyEffect,
}

impl AccessPolicy {
    pub fn new(
        name: &str,
        subject_type: AccessPolicySubjectType,
        subject_id: Uuid,
        context_app_id: Option<String>,
        resource_type: AccessPolicyResourceType,
        resource_id: Uuid,
        action: &str,
        effect: AccessPolicyEffect,
    ) -> Self {
        Self {
            id: get_uuid(),
            name: name.to_string(),
            created_time: chrono::Utc::now().naive_utc(),
            modified_time: chrono::Utc::now().naive_utc(),
            subject_type,
            subject_id,
            context_app_id,
            resource_type,
            resource_id,
            action: action.to_string(),
            effect,
        }
    }
}

#[derive(Queryable, Selectable, Clone, Insertable, Debug, QueryableByName)]
#[diesel(check_for_backend(Pg))]
#[diesel(table_name = crate::schema::tags)]
pub struct Tag {
    pub id: Uuid,
    pub key: String,
    pub value: String,
}

impl Tag {
    pub fn new(key: &str, value: &str) -> Self {
        Self {
            id: get_uuid(),
            key: key.to_string(),
            value: value.to_string(),
        }
    }
}

#[derive(Queryable, Selectable, Clone, Insertable, Debug, Associations, QueryableByName)]
#[diesel(check_for_backend(Pg))]
#[diesel(table_name = crate::schema::file_tag_members)]
#[diesel(belongs_to(File, foreign_key = file_id))]
#[diesel(belongs_to(Tag, foreign_key = tag_id))]
pub struct FileTagMember {
    pub file_id: Uuid,
    pub tag_id: Uuid,
    pub created_time: chrono::NaiveDateTime,
    pub created_by_user_id: Uuid,
}

impl FileTagMember {
    pub fn new(file_id: Uuid, tag_id: Uuid, created_by_user_id: Uuid) -> Self {
        Self {
            file_id,
            tag_id,
            created_time: chrono::Utc::now().naive_utc(),
            created_by_user_id,
        }
    }
}
