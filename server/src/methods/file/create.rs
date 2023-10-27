use crate::{
    config::SERVER_CONFIG,
    db::DB,
    internal_types::Auth,
    some_or_bail,
    types::FilezFile,
    utils::{check_file_name, check_mime_type, generate_id, get_folder_and_file_path},
};
use anyhow::bail;
use hyper::{body::HttpBody, Body, Request, Response};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    fs::{self, File},
    io::Write,
    vec,
};
use ts_rs::TS;

/**
# Creates a new file.

## Call
`/api/file/create/`
## Permissions
None
The options for calling the create file function are:
- Create a file as authenticated user
- Create a file in an uploadSpace with a token

the upload space has to be created by an authenticated user and access to it can be shared with a token
files uploaded will be owned by the owner of the upload space and decrease their quota as normal

*/
pub async fn create_file(
    mut req: Request<Body>,
    db: DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let config = &SERVER_CONFIG;

    let (user_id, upload_space) = match &auth.authenticated_ir_user_id {
        Some(ir_user_id) => match db.get_user_id_by_ir_id(ir_user_id).await? {
            Some(u) => (u, None),
            None => return Ok(res.status(412).body(Body::from("User has not been created on the filez server, although it is present on the IR server. Run create_own first."))?),
        },
        None => match &auth.token {
            Some(token) => {
                if config.dev.disable_complex_access_control {
                    return Ok(res
                        .status(401)
                        .body(Body::from("Complex access control has been disabled"))?);
                }
                let upload_space = some_or_bail!(
                    db.get_upload_space_by_token(token).await?,
                    "No upload space with this token found"
                );
                (upload_space.owner_id.clone(), Some(upload_space))
            }
            None => return Ok(res.status(401).body(Body::from("Unauthorized"))?),
        },
    };

    let request_header =
        some_or_bail!(req.headers().get("request"), "Missing request header").to_str()?;
    if request_header.len() > 5000 {
        bail!("Invalid request header");
    }

    let create_request: CreateFileRequest = serde_json::from_str(request_header)?;

    check_file_name(&create_request.name)?;
    check_mime_type(&create_request.mime_type)?;

    let user = some_or_bail!(db.get_user_by_id(&user_id).await?, "User not found");

    let storage_name = create_request
        .storage_id
        .unwrap_or_else(|| config.default_storage.clone());

    // check for user limits
    // first size check
    let size_hint = req.body().size_hint();
    let storage_limits = some_or_bail!(
        user.limits.get(&storage_name),
        format!("Invalid storage name: {}", storage_name)
    );

    let bytes_left = storage_limits.max_storage - storage_limits.used_storage;
    if size_hint.lower() > bytes_left
        || size_hint.upper().is_some() && size_hint.upper().unwrap() > bytes_left
    {
        bail!("User storage limit exceeded");
    }

    // file count check
    if storage_limits.used_files >= storage_limits.max_files {
        bail!("User file limit exceeded");
    }

    // check for upload space limits

    if let Some(upload_space) = &upload_space {
        let upload_space_limits = some_or_bail!(
            upload_space.limits.get(&storage_name),
            format!("Invalid storage name: {}", storage_name)
        );
        let bytes_left_upload_space =
            upload_space_limits.max_storage - upload_space_limits.used_storage;

        if size_hint.lower() > bytes_left_upload_space
            || size_hint.upper().is_some() && size_hint.upper().unwrap() > bytes_left_upload_space
        {
            bail!("UploadSpace storage limit exceeded");
        }

        // file count check
        if upload_space_limits.used_files >= upload_space_limits.max_files {
            bail!("UploadSpace file limit exceeded");
        }
    }

    let storage_path = some_or_bail!(
        config.storage.get(&storage_name),
        format!(
            "Storage name: '{}' is missing in the config file",
            storage_name
        )
    )
    .path
    .clone();

    let file_id = generate_id(16);
    let (folder_path, file_name) = get_folder_and_file_path(&file_id, &storage_path);

    fs::create_dir_all(&folder_path)?;
    // write file to disk but abbort if limits where exceeded
    let file_path = format!("{}/{}", folder_path, file_name);
    let mut file = File::create(&file_path)?;
    let mut hasher = Sha256::new();

    let mut bytes_written = 0;
    while let Some(chunk) = req.body_mut().data().await {
        let chunk = chunk?;
        bytes_written += chunk.len() as u64;

        if bytes_written > config.constraints.max_file_size {
            fs::remove_file(&file_path)?;
            bail!("Server Config file size limit exceeded");
        };

        // check if file size limit is exceeded for the user
        if bytes_written > bytes_left {
            fs::remove_file(&file_path)?;
            bail!("User storage limit exceeded");
        }

        // check if file size limit is exceeded for the upload space if present
        if let Some(upload_space) = &upload_space {
            let upload_space_limits = some_or_bail!(
                upload_space.limits.get(&storage_name),
                format!("Invalid storage name: {}", storage_name)
            );
            let bytes_left_upload_space =
                upload_space_limits.max_storage - upload_space_limits.used_storage;
            if bytes_written > bytes_left_upload_space {
                fs::remove_file(&file_path)?;
                bail!("UploadSpace storage limit exceeded");
            }
        }

        hasher.write_all(&chunk)?;
        file.write_all(&chunk)?;
    }

    let hash = hex::encode(hasher.finalize());
    let current_time = chrono::offset::Utc::now().timestamp_millis();

    let mut file_manual_group_ids = vec![];

    if let Some(mut cr_groups) = create_request.static_file_group_ids.clone() {
        file_manual_group_ids.append(&mut cr_groups);
    }

    if let Some(upload_space) = &upload_space {
        file_manual_group_ids.push(upload_space.file_group_id.clone());
    }

    //check if file group ids exist and if they are owned by the files owner
    let user_owned_file_groups = db
        .get_file_groups_by_owner_id(&user_id)
        .await?
        .iter()
        .map(|g| g.file_group_id.clone())
        .collect::<Vec<String>>();

    let file_manual_group_ids_checked = file_manual_group_ids
        .clone()
        .into_iter()
        .filter(|g| user_owned_file_groups.contains(g))
        .count();

    if file_manual_group_ids_checked != file_manual_group_ids.len() {
        bail!("Invalid file group id");
    }

    file_manual_group_ids.push(format!("{}_all", user_id));

    let app_data: HashMap<String, Value> = HashMap::new();

    // update db in this "create file transaction"
    let cft = db
        .create_file(
            FilezFile {
                file_id: file_id.clone(),
                mime_type: create_request.mime_type,
                name: create_request.name,
                owner_id: user.user_id,
                pending_new_owner_id: None,
                sha256: Some(hash.clone()),
                storage_id: Some(storage_name.clone()),
                size: bytes_written,
                server_created: current_time,
                modified: create_request.modified.map(|o| o * 1000),
                static_file_group_ids: file_manual_group_ids,
                dynamic_file_group_ids: vec![],
                app_data,
                accessed: None,
                accessed_count: 0,
                time_of_death: None,
                created: create_request
                    .created
                    .map(|o| o * 1000)
                    .unwrap_or(current_time),
                permission_ids: vec![],
                keywords: vec![],
                path: file_path.clone(),
                readonly: false,
            },
            false,
        )
        .await;

    match cft {
        Ok(_) => {
            let cfr = CreateFileResponse {
                file_id,
                storage_name,
                sha256: hash,
            };
            Ok(res
                .status(201)
                .body(Body::from(serde_json::to_string(&cfr)?))?)
        }
        Err(e) => {
            fs::remove_file(&file_path)?;
            bail!("Failed to create file in database: {}", e);
        }
    }
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct CreateFileRequest {
    pub name: String,
    pub mime_type: String,
    pub storage_id: Option<String>,
    pub static_file_group_ids: Option<Vec<String>>,
    pub created: Option<i64>,
    pub modified: Option<i64>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct CreateFileResponse {
    pub file_id: String,
    pub storage_name: String,
    pub sha256: String,
}
