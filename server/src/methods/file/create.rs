use crate::{
    config::SERVER_CONFIG,
    db::DB,
    dynamic_groups::{handle_dynamic_group_update, UpdateType},
    internal_types::Auth,
    is_transient_transaction_error, some_or_bail,
    utils::{check_file_name, check_keywords, check_mime_type, generate_id},
};
use anyhow::bail;
use filez_common::{server::FilezFile, storage::index::get_future_storage_location};
use hyper::{body::HttpBody, Body, Request, Response};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use simple_server_timing_header::Timer;
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

## Possible Mutations
Mutation > FilezFile
Mutation > FilezFileGroup
Mutation > FilezUser

## Multiple Resources
No

*/

// TODO add upload space support
// TODO add multi file support: this isn't a concern for large files as the speed is probably not bound by the db but by the network, for huge quantities of small files this is a problem as there is a huge waiting time for the db to finish the transaction compared to the transfer time because its limited by the transaction speed of the db even concurrent requests are limited by the transaction speed of the db

pub async fn create_file(
    mut req: Request<Body>,
    db: &DB,
    auth: &Auth,
    res: hyper::http::response::Builder,
) -> anyhow::Result<Response<Body>> {
    let config = &SERVER_CONFIG;
    let mut timer = Timer::new();

    let requesting_user = crate::get_authenticated_user!(req, res, auth, db);
    timer.add("10 Get Authenticated User");

    let user_id = requesting_user.user_id.clone();

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
        .unwrap_or_else(|| config.storage.default_storage.clone());

    // check for user limits
    // first size check
    let size_hint = req.body().size_hint();
    let storage_limits = match &user.limits.get(&storage_name) {
        Some(Some(ul)) => ul,
        _ => bail!(
            "Storage name: '{}' is missing specifications on the user entry",
            storage_name
        ),
    };

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
    /*
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
    */

    let file_id = generate_id(16);
    let future_storage_location =
        get_future_storage_location(&config.storage, &file_id, Some(&storage_name))?;

    fs::create_dir_all(&future_storage_location.folder_path)?;

    // write file to disk but abbort if limits where exceeded
    let file_path = future_storage_location.full_path;
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

        /*
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
        */
        hasher.write_all(&chunk)?;
        file.write_all(&chunk)?;
    }

    let hash = hex::encode(hasher.finalize());
    let current_time = chrono::offset::Utc::now().timestamp_millis();

    let mut file_manual_group_ids = vec![];

    if let Some(mut cr_groups) = create_request.static_file_group_ids.clone() {
        file_manual_group_ids.append(&mut cr_groups);
    }
    /*
        if let Some(upload_space) = &upload_space {
            file_manual_group_ids.push(upload_space.file_group_id.clone());
        }
    */
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

    if let Some(keywords) = &create_request.keywords {
        check_keywords(keywords)?;
    };

    let new_filez_file = FilezFile {
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
        keywords: create_request.keywords.unwrap_or(vec![]),
        readonly: false,
        readonly_path: None,
        linked_files: vec![],
        manual_group_sortings: HashMap::new(),
        sub_type: None,
    };
    timer.add("20 Check Limits and Create File");

    // update db in this "create file transaction"
    while let Err(e) = db.create_file(new_filez_file.clone(), false).await {
        if is_transient_transaction_error!(e) {
            continue;
        } else {
            fs::remove_file(&file_path)?;
            bail!("Failed to create file in database: {}", e);
        }
    }
    timer.add("30 Create File in DB");

    handle_dynamic_group_update(
        db,
        &UpdateType::Files((vec![new_filez_file], None)),
        &requesting_user.user_id,
    )
    .await?;

    let cfr = CreateFileResponse {
        file_id,
        storage_name,
        sha256: hash,
    };
    Ok(res
        .status(200)
        .header("Server-Timing", timer.header_value())
        .body(Body::from(serde_json::to_string(&cfr)?))?)
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct CreateFileRequest {
    pub name: String,
    pub mime_type: String,
    pub storage_id: Option<String>,
    pub static_file_group_ids: Option<Vec<String>>,
    #[ts(type = "number")]
    pub created: Option<i64>,
    #[ts(type = "number")]
    pub modified: Option<i64>,
    pub keywords: Option<Vec<String>>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone, TS)]
#[ts(export, export_to = "../clients/ts/src/apiTypes/")]
pub struct CreateFileResponse {
    pub file_id: String,
    pub storage_name: String,
    pub sha256: String,
}
