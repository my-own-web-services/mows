#[macro_export]
macro_rules! some_or_bail {
    ( $option:expr, $message:expr ) => {{
        if let Some(val) = $option {
            val
        } else {
            anyhow::bail!($message)
        }
    }};
}

#[macro_export]
macro_rules! into_permissive_resource {
    ($resource:expr) => {{
        $resource
            .iter()
            .map(|r| {
                Box::new((*r).clone())
                    as Box<dyn filez_common::server::permission::PermissiveResource>
            })
            .collect()
    }};
}

#[macro_export]
macro_rules! is_transient_transaction_error {
    ($error:expr ) => {
        $error
            .to_string()
            .contains(mongodb::error::TRANSIENT_TRANSACTION_ERROR)
    };
}

#[macro_export]
macro_rules! retry_transient_transaction_error {
    ($command:expr ) => {
        while let Err(e) = $command {
            if e.to_string()
                .contains(mongodb::error::TRANSIENT_TRANSACTION_ERROR)
            {
                continue;
            } else {
                anyhow::bail!(e)
            }
        }
    };
}

#[macro_export]
macro_rules! check_content_type_json {
    ($req:expr, $res:expr) => {
        match $req.headers().get("Content-Type") {
            Some(v) => {
                if v != hyper::header::HeaderValue::from_static("application/json") {
                    return Ok($res.status(400).body(Body::from("Invalid Content-Type"))?);
                }
            }
            _ => return Ok($res.status(400).body(Body::from("Missing Content-Type"))?),
        };
    };
}

#[macro_export]
macro_rules! get_authenticated_user {
    ($req:expr, $res:expr, $auth:expr, $db:expr) => {
        match &$auth.authenticated_ir_user_id {
            Some(ir_user_id) => match $db.get_user_by_ir_id(ir_user_id).await? {
                Some(u) => u,
                None => return Ok($res.status(412).body(Body::from("User has not been created on the filez server, although it is present on the IR server. Run create_own first."))?),
            },
            None => return Ok($res.status(401).body(Body::from("Unauthorized"))?),
        }
    };
}

#[macro_export]
macro_rules! delete_permissions {
    ($self:expr,$session:expr, $permission_ids_by_resource_type:expr, $resource_type:ident, $resource_selector: expr) => {{
        if let Some(permission_ids) = $permission_ids_by_resource_type.get($resource_selector) {
            let resource_collection = $self.db.collection::<$resource_type>($resource_selector);
            resource_collection
                .update_many_with_session(
                    doc! {
                        "permission_ids": {
                            "$in": permission_ids
                        }
                    },
                    doc! {
                        "$pullAll": {
                            "permission_ids": permission_ids
                        }
                    },
                    None,
                    &mut $session,
                )
                .await?;
            let permissions_collection = $self.db.collection::<FilezPermission>("permissions");

            permissions_collection
                .delete_many_with_session(
                    doc! {
                        "_id": {
                            "$in": permission_ids
                        }
                    },
                    None,
                    &mut $session,
                )
                .await?;
        }
    }};
}
