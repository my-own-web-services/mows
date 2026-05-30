//! Minimal chat-side user model.
//!
//! Chat doesn't own the user identity (that's the IdP). This model
//! is the chat-local projection that lets the engine reference a
//! user via `subject_type = User` and lets channel ownership use
//! a real FK. Round 5 adds the introspection-driven create-on-first-
//! sight path; Round 2 only needs the type to exist + the nobody
//! sentinel id constant for system-initiated audit rows.

use diesel::{
    pg::Pg,
    prelude::{Insertable, Queryable},
    Selectable,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{impl_typed_uuid, schema};

impl_typed_uuid!(UserId);

/// All-zero sentinel — engine convention (see filez migration
/// 00010). Used as the `owner_id` placeholder on system-initiated
/// rows.
pub const NOBODY_USER_ID: Uuid = Uuid::nil();

#[derive(Serialize, Deserialize, Queryable, Selectable, Insertable, ToSchema, Clone, Debug)]
#[diesel(table_name = schema::users)]
#[diesel(check_for_backend(Pg))]
pub struct User {
    pub id: UserId,
    pub external_user_id: Option<String>,
    pub display_name: String,
    pub created_time: chrono::NaiveDateTime,
    pub modified_time: chrono::NaiveDateTime,
    pub deleted: bool,
    pub user_type: i16,
    pub idp_id: Uuid,
}
