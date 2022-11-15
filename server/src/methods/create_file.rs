use crate::{
    config::SERVER_CONFIG,
    db::DB,
    internal_types::Auth,
    some_or_bail,
    types::{CreateFileRequest, CreateFileResponse, FilezFile},
    utils::{generate_id, get_folder_and_file_path},
};
use anyhow::bail;
use hyper::{body::HttpBody, Body, Request, Response};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    fs::{self, File},
    io::Write,
    vec,
};

/*
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
) -> anyhow::Result<Response<Body>> {
    let config = &SERVER_CONFIG;
    let (user_id, upload_space) = match &auth.authenticated_user {
        Some(user_id) => (user_id.clone(), None),
        None => match &auth.token {
            Some(token) => {
                let upload_space = db.get_upload_space_by_token(token).await?;
                (upload_space.owner_id.clone(), Some(upload_space))
            }
            None => {
                return Ok(Response::builder()
                    .status(401)
                    .body(Body::from("Unauthorized"))?)
            }
        },
    };

    let request_header =
        some_or_bail!(req.headers().get("request"), "Missing request header").to_str()?;
    if request_header.len() > 5000 {
        bail!("Invalid request header");
    }

    let create_request: CreateFileRequest = serde_json::from_str(request_header)?;

    let user = db.get_user_by_id(&user_id).await?;

    let storage_name = create_request
        .storage_name
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
            "Storage name: '{}' is missing specifications on the user entry",
            storage_name
        )
    )
    .path
    .clone();

    let file_id = generate_id();
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

    if let Some(mut cr_groups) = create_request.groups.clone() {
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

    let app_data: HashMap<String, Value> = HashMap::new();

    // update db in this "create file transaction"
    let cft = db
        .create_file(FilezFile {
            file_id: file_id.clone(),
            mime_type: create_request.mime_type,
            name: create_request.name,
            owner_id: user.user_id,
            sha256: hash.clone(),
            storage_name: storage_name.clone(),
            size: bytes_written,
            server_created: current_time,
            modified: create_request.modified,
            static_file_group_ids: file_manual_group_ids,
            dynamic_file_group_ids: vec![],
            app_data,
            accessed: None,
            accessed_count: 0,
            time_of_death: None,
            created: create_request.created.unwrap_or(current_time),
            permission_ids: vec![],
            keywords: vec![],
            path: file_path.clone(),
        })
        .await;

    match cft {
        Ok(_) => {
            let cfr = CreateFileResponse {
                file_id,
                storage_name,
                sha256: hash,
            };
            Ok(Response::builder()
                .status(201)
                .body(Body::from(serde_json::to_string(&cfr)?))?)
        }
        Err(e) => {
            fs::remove_file(&file_path)?;
            bail!("Failed to create file in database: {}", e);
        }
    }
}
