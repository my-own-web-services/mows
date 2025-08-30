#[macro_export]
macro_rules! with_timing {
    ($function: expr, $description: expr, $timing: expr) => {{
        #[cfg(feature = "timing")]
        let start = std::time::Instant::now();

        let result = $function;

        #[cfg(feature = "timing")]
        let function_name = stringify!($function)
            .split('(')
            .next()
            .unwrap_or(stringify!($function))
            .trim()
            .replace("::", "_")
            .replace(".", "_");
        #[cfg(feature = "timing")]
        $timing.lock().unwrap().record_timing(
            function_name.to_string(),
            start.elapsed(),
            Some($description.to_string()),
        );

        result
    }};
}

#[macro_export]
macro_rules! get_resource_label {
    ($resource: expr) => {{
        let id = $resource.id;
        let name = $resource.name;
        format!("(id: {}, name: {})", id, name)
    }};
}

#[macro_export]
macro_rules! impl_typed_uuid {
    ($name:ident) => {
        #[derive(
            Clone,
            Copy,
            Debug,
            PartialEq,
            Eq,
            PartialOrd,
            Ord,
            Hash,
            serde::Serialize,
            serde::Deserialize,
            diesel::AsExpression,
            diesel::FromSqlRow,
            utoipa::ToSchema,
        )]
        #[diesel(sql_type = diesel::sql_types::Uuid)]
        #[schema(value_type = String, format = Uuid)]
        pub struct $name(pub uuid::Uuid);

        impl $name {
            pub fn new() -> Self {
                let ts = uuid::Timestamp::now(uuid::NoContext);
                Self(uuid::Uuid::new_v7(ts))
            }

            pub fn nil() -> Self {
                Self(uuid::Uuid::nil())
            }
        }

        impl From<uuid::Uuid> for $name {
            fn from(uuid: uuid::Uuid) -> Self {
                Self(uuid)
            }
        }

        impl From<$name> for uuid::Uuid {
            fn from(id: $name) -> Self {
                id.0
            }
        }

        impl std::str::FromStr for $name {
            type Err = uuid::Error;

            fn from_str(s: &str) -> Result<Self, Self::Err> {
                uuid::Uuid::from_str(s).map(Self)
            }
        }

        impl std::fmt::Display for $name {
            fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                write!(f, "{}", self.0)
            }
        }

        impl<DB> diesel::deserialize::FromSql<diesel::sql_types::Uuid, DB> for $name
        where
            DB: diesel::backend::Backend,
            uuid::Uuid: diesel::deserialize::FromSql<diesel::sql_types::Uuid, DB>,
        {
            fn from_sql(bytes: DB::RawValue<'_>) -> diesel::deserialize::Result<Self> {
                uuid::Uuid::from_sql(bytes).map(Self)
            }
        }

        impl<DB> diesel::serialize::ToSql<diesel::sql_types::Uuid, DB> for $name
        where
            DB: diesel::backend::Backend,
            uuid::Uuid: diesel::serialize::ToSql<diesel::sql_types::Uuid, DB>,
        {
            fn to_sql<'b>(
                &'b self,
                out: &mut diesel::serialize::Output<'b, '_, DB>,
            ) -> diesel::serialize::Result {
                self.0.to_sql(out)
            }
        }
    };
}

#[macro_export]
macro_rules! impl_typed_compound_uuid {
    ($name:ident: $($component:ident),+) => {

        $(

            impl PartialEq<$component> for $name {
                fn eq(&self, other: &$component) -> bool {
                    self.0 == other.0
                }
            }

            impl PartialEq<$name> for $component {
                fn eq(&self, other: &$name) -> bool {
                    self.0 == other.0
                }
            }

            impl From<$component> for $name {
                fn from(id: $component) -> Self {
                    Self(id.0)
                }
            }
        )+
    };
}
