use crate::{
    config::SERVER_CONFIG,
    some_or_bail,
    types::{
        AppDataType, DeleteGroupRequestBody, DeletePermissionRequestBody, FilezFile,
        FilezFileGroup, FilezGroups, FilezPermission, FilezUser, FilezUserGroup, SetAppDataRequest,
        SortOrder, UpdatePermissionsRequestBody, UploadSpace, UsageLimits,
    },
};
use anyhow::bail;
use futures::{stream::TryStreamExt, StreamExt};
use mongodb::{
    bson::doc,
    options::FindOptions,
    results::{DeleteResult, InsertOneResult, UpdateResult},
};
use mongodb::{options::ClientOptions, Client, Database, IndexModel};
use std::{collections::HashMap, vec};

pub struct DB {
    pub client: Client,
    pub db: Database,
}

impl DB {
    pub async fn new(client_options: ClientOptions) -> anyhow::Result<Self> {
        let client = Client::with_options(client_options)?;
        let db = client.database("filez");
        Ok(Self { client, db })
    }

    pub async fn create_collections(&self) -> anyhow::Result<()> {
        let collections = vec![
            "users",
            "files",
            "permissions",
            "userGroups",
            "fileGroups",
            "uploadSpaces",
        ];

        for collection in collections {
            let _ = self.db.create_collection(collection, None).await;
        }

        let files_collection = self.db.collection::<FilezFile>("files");

        files_collection.drop_indexes(None).await?;

        {
            let index = IndexModel::builder()
                .keys(doc! {"staticFileGroupIds": 1})
                .build();
            files_collection.create_index(index, None).await?;
        }
        {
            let index = IndexModel::builder()
                .keys(doc! {"dynamicFileGroupIds": 1})
                .build();
            files_collection.create_index(index, None).await?;
        }
        {
            let index = IndexModel::builder().keys(doc! {"keywords": 1}).build();
            files_collection.create_index(index, None).await?;
        }
        {
            let index = IndexModel::builder().keys(doc! {"ownerId": 1}).build();
            files_collection.create_index(index, None).await?;
        }

        {
            let index = IndexModel::builder().keys(doc! {"$**": "text"}).build();
            files_collection.create_index(index, None).await?;
        }

        Ok(())
    }

    pub async fn search(
        &self,
        query: &str,
        file_group_id: &str,
        limit: u32,
    ) -> anyhow::Result<Vec<FilezFile>> {
        let collection = self.db.collection::<FilezFile>("files");

        // get maximum size for group
        let file_group = if let Some(fg) = self.get_file_group_by_id(file_group_id).await? {
            fg
        } else {
            bail!("File group not found");
        };

        let max_size = file_group.item_count;

        let options1 = FindOptions::builder()
            .limit(limit as i64)
            .sort(doc! { "score": { "$meta": "textScore" } })
            .build();

        // the mongodb text search is very strange and incosistent
        // if the limit is not reached AND there are still files left in the collection/group
        // we search the most relevant fields for substring matches
        // if this still is not enough, we search for a substring match in all fields
        // .find({$where:"JSON.stringify(this).indexOf('aa')!=-1"})

        let files1 = collection
            .find(
                doc! {
                    "$and": [
                        { "$or": [
                                {"staticFileGroupIds": file_group_id},
                                {"dynamicFileGroupIds": file_group_id}
                            ]
                        },
                        { "$text": { "$search": query } }
                    ]
                },
                options1,
            )
            .await?
            .try_collect::<Vec<_>>()
            .await?;

        // if we matched all files we can return
        if files1.len() >= max_size as usize || files1.len() >= limit as usize {
            Ok(files1)
        } else {
            let options2 = FindOptions::builder().limit(limit as i64).build();
            let files2 = collection
                .find(
                    doc! {
                        "$and": [
                            {
                                "$or": [
                                    {"staticFileGroupIds": file_group_id},
                                    {"dynamicFileGroupIds": file_group_id}
                                ]
                            },
                            {
                                "$or": [
                                    {
                                        "name": {
                                            "$regex": query
                                        }
                                    },
                                    {
                                        "_id": query
                                    },
                                    {
                                        "ownerId": query
                                    },
                                    {
                                        "keywords": {
                                            "$regex": query
                                        }
                                    }
                                ]
                            },
                        ]
                    },
                    options2,
                )
                .await?
                .try_collect::<Vec<_>>()
                .await?;

            if files2.len() >= max_size as usize || files2.len() >= limit as usize {
                // combine files1 and files2 and sort out duplicates differentiated by _id

                let mut new_files: Vec<FilezFile> = vec![];

                let mut file_map: HashMap<String, FilezFile> = HashMap::new();

                for file in files1 {
                    file_map.insert(file.file_id.clone(), file);
                }

                for file in files2 {
                    file_map.insert(file.file_id.clone(), file);
                }

                for (_, file) in file_map {
                    new_files.push(file);
                }

                Ok(new_files)
            } else {
                let options3 = FindOptions::builder().limit(limit as i64).build();
                let files3 = collection
                    .find(
                        doc! {
                            "$and": [
                                {
                                    "$or": [
                                        {"staticFileGroupIds": file_group_id},
                                        {"dynamicFileGroupIds": file_group_id}
                                    ]
                                },
                                {
                                    "$where":format!("JSON.stringify(this).indexOf('{}')!=-1",query)
                                },
                            ]
                        },
                        options3,
                    )
                    .await?
                    .try_collect::<Vec<_>>()
                    .await?;

                let mut new_files: Vec<FilezFile> = vec![];

                let mut file_map: HashMap<String, FilezFile> = HashMap::new();

                for file in files1 {
                    file_map.insert(file.file_id.clone(), file);
                }

                for file in files2 {
                    file_map.insert(file.file_id.clone(), file);
                }

                for file in files3 {
                    file_map.insert(file.file_id.clone(), file);
                }

                for (_, file) in file_map {
                    new_files.push(file);
                }

                Ok(new_files)
            }
        }
    }

    pub async fn create_dev_user(&self) -> anyhow::Result<()> {
        match self.create_user("dev").await {
            Ok(_) => Ok(()),
            Err(e) => {
                println!("Error creating dev user: {}", e);
                Ok(())
            }
        }
    }

    pub async fn get_upload_space_by_token(
        &self,
        upload_space_id: &str,
    ) -> anyhow::Result<Option<UploadSpace>> {
        let collection = self.db.collection::<UploadSpace>("uploadSpaces");
        let res = collection
            .find_one(doc! {"_id": upload_space_id}, None)
            .await?;

        Ok(res)
    }

    pub async fn create_upload_space(&self, upload_space: &UploadSpace) -> anyhow::Result<()> {
        let collection = self.db.collection::<UploadSpace>("uploadSpaces");
        collection.insert_one(upload_space, None).await?;

        Ok(())
    }

    pub async fn update_file_group(&self, file_group: &FilezFileGroup) -> anyhow::Result<()> {
        let collection = self.db.collection::<FilezFileGroup>("fileGroups");
        collection
            .update_one(
                doc! {"_id": file_group.file_group_id.clone()},
                doc! {"$set": bson::to_bson(file_group)?},
                None,
            )
            .await?;

        Ok(())
    }

    pub async fn get_dynamic_groups_by_owner_id(
        &self,
        owner_id: &str,
    ) -> anyhow::Result<Vec<FilezFileGroup>> {
        let collection = self.db.collection::<FilezFileGroup>("fileGroups");
        let res = collection
            .find(
                doc! {
                "$and":[
                    {
                        "ownerId": {
                            "$eq":owner_id
                        }
                    },
                    {
                        "groupType": {
                            "$eq": "dynamic"
                        }
                    }
                    ]
                },
                FindOptions::builder().build(),
            )
            .await?
            .try_collect::<Vec<_>>()
            .await?;

        Ok(res)
    }

    pub async fn update_file_groups_on_many_files(
        &self,
        to_be_updated: &Vec<(String, Vec<String>)>,
    ) -> anyhow::Result<()> {
        let mut session = self.client.start_session(None).await?;
        session.start_transaction(None).await?;

        let files_collection = self.db.collection::<FilezFile>("files");
        let file_groups_collection = self.db.collection::<FilezFileGroup>("fileGroups");

        // TODO make this faster by using bulk operations

        let mut file_count_map: HashMap<String, u64> = HashMap::new();

        for (file_id, dynamic_file_group_ids) in to_be_updated {
            for file_group_id in dynamic_file_group_ids {
                if file_count_map.contains_key(file_group_id) {
                    let count = file_count_map.get(file_group_id).unwrap();
                    file_count_map.insert(file_group_id.clone(), count + 1);
                } else {
                    file_count_map.insert(file_group_id.clone(), 1);
                }
            }

            if !dynamic_file_group_ids.is_empty() {
                files_collection
                    .update_one_with_session(
                        doc! {"_id": file_id},
                        doc! {"$push": {"dynamicFileGroupIds": &dynamic_file_group_ids[0]}},
                        None,
                        &mut session,
                    )
                    .await?;
            }
        }

        //set the new file count on the groups
        for (file_group_id, file_count) in file_count_map {
            file_groups_collection
                .update_one_with_session(
                    doc! {"_id": file_group_id},
                    doc! {"$set": {"itemCount": bson::to_bson(&file_count)?}},
                    None,
                    &mut session,
                )
                .await?;
        }

        Ok(session.commit_transaction().await?)
    }

    pub async fn get_files_by_owner_id(&self, owner_id: &str) -> anyhow::Result<Vec<FilezFile>> {
        let collection = self.db.collection::<FilezFile>("files");
        let res = collection
            .find(doc! {"ownerId": owner_id}, FindOptions::builder().build())
            .await?
            .try_collect::<Vec<_>>()
            .await?;

        Ok(res)
    }

    pub async fn update_permission_ids_on_resource(
        &self,
        upr: &UpdatePermissionsRequestBody,
        user_id: &str,
    ) -> anyhow::Result<UpdateResult> {
        // check if all permissions are owned by the user
        let user_owned_permissions = self.get_permissions_by_owner_id(user_id).await?;

        let mut all_owned = true;

        for permission_id in &upr.permission_ids {
            let mut perm_owned = false;
            for owned_permission in &user_owned_permissions {
                if owned_permission.permission_id == *permission_id {
                    perm_owned = true;
                    break;
                }
            }
            if !perm_owned {
                all_owned = false;
                break;
            }
        }

        if !all_owned {
            bail!("Not all permissions are owned by the user so they cant be used on the resource");
        }

        // update permissions on the resource
        Ok(match upr.resource_type {
            crate::types::FileResourceType::FileGroup => {
                let group = some_or_bail!(
                    self.get_file_group_by_id(&upr.resource_id).await?,
                    "Could not find file group"
                );
                if group.owner_id != user_id {
                    bail!("You do not own this FileGroup");
                }

                let collection = self.db.collection::<FilezFileGroup>("fileGroups");
                // update permissions on the file group

                collection
                    .update_one(
                        doc! {"_id": group.file_group_id},
                        doc! {"$set": {"permissionIds": upr.permission_ids.clone()}},
                        None,
                    )
                    .await?
            }
            crate::types::FileResourceType::File => {
                let file = some_or_bail!(
                    self.get_file_by_id(&upr.resource_id).await?,
                    "Could not find file"
                );
                if file.owner_id != user_id {
                    bail!("You do not own this file");
                }

                let collection = self.db.collection::<FilezFile>("files");
                // update permissions on the file
                collection
                    .update_one(
                        doc! {"_id": file.file_id},
                        doc! {"$set": {"permissionIds": upr.permission_ids.clone()}},
                        None,
                    )
                    .await?
            }
        })
    }

    pub async fn get_permissions_by_owner_id(
        &self,
        owner_id: &str,
    ) -> anyhow::Result<Vec<FilezPermission>> {
        let collection = self.db.collection::<FilezPermission>("permissions");
        let permissions = collection
            .find(doc! {"ownerId": owner_id}, None)
            .await?
            .try_collect::<Vec<_>>()
            .await?;
        Ok(permissions)
    }

    pub async fn get_file_group_by_id(
        &self,
        file_group_id: &str,
    ) -> anyhow::Result<Option<FilezFileGroup>> {
        let collection = self.db.collection::<FilezFileGroup>("fileGroups");

        let res = collection
            .find_one(doc! {"_id": file_group_id}, None)
            .await?;

        Ok(res)
    }

    pub async fn create_user(&self, user_id: &str) -> anyhow::Result<()> {
        let mut session = self.client.start_session(None).await?;
        session.start_transaction(None).await?;

        let users_collection = self.db.collection::<FilezUser>("users");
        let config = &SERVER_CONFIG;

        let user = users_collection
            .find_one(doc! {"_id": user_id}, None)
            .await?;
        if user.is_some() {
            bail!("User already exists")
        }

        let mut limits: HashMap<String, UsageLimits> = HashMap::new();

        for (storage_name, storage_config) in &config.storage {
            let dul = &storage_config.default_user_limits;
            limits.insert(
                storage_name.to_string(),
                UsageLimits {
                    max_storage: dul.max_storage,
                    used_storage: 0,
                    max_files: dul.max_files,
                    used_files: 0,
                    max_bandwidth: dul.max_bandwidth,
                    used_bandwidth: 0,
                },
            );
        }

        let user = FilezUser {
            user_id: user_id.to_string(),
            app_data: HashMap::new(),
            limits,
            user_group_ids: vec![],
        };

        users_collection
            .insert_one_with_session(&user, None, &mut session)
            .await?;

        let file_groups_collection = self.db.collection::<FilezFileGroup>("fileGroups");

        file_groups_collection
            .insert_one_with_session(
                &FilezFileGroup {
                    file_group_id: format!("{}_all", user_id),
                    owner_id: user_id.to_string(),
                    name: Some("All".to_string()),
                    permission_ids: vec![],
                    keywords: vec![],
                    mime_types: vec![],
                    group_hierarchy_paths: vec![],
                    group_type: crate::types::FileGroupType::Static,
                    dynamic_group_rules: None,
                    item_count: 0,
                },
                None,
                &mut session,
            )
            .await?;

        Ok(session.commit_transaction().await?)
    }

    pub async fn get_file_groups_by_owner_id(
        &self,
        owner_id: &str,
    ) -> anyhow::Result<Vec<FilezFileGroup>> {
        let collection = self.db.collection::<FilezFileGroup>("fileGroups");

        let file_groups = collection
            .find(doc! {"ownerId": owner_id}, None)
            .await?
            .try_collect::<Vec<_>>()
            .await?;

        Ok(file_groups)
    }

    pub async fn get_user_group_by_id(
        &self,
        user_group_id: &str,
    ) -> anyhow::Result<Option<FilezUserGroup>> {
        let collection = self.db.collection::<FilezUserGroup>("userGroups");

        let res = collection
            .find_one(doc! {"_id": user_group_id}, None)
            .await?;

        Ok(res)
    }

    pub async fn delete_permission(
        &self,
        dpr: &DeletePermissionRequestBody,
        owner_id: &str,
    ) -> anyhow::Result<DeleteResult> {
        let collection = self.db.collection::<FilezPermission>("permissions");

        Ok(collection
            .delete_one(
                doc! {
                    "permissionId": dpr.permission_id.clone(),
                    "ownerId": owner_id
                },
                None,
            )
            .await?)
    }

    pub async fn delete_group(
        &self,
        dgr: &DeleteGroupRequestBody,
        owner_id: &str,
    ) -> anyhow::Result<DeleteResult> {
        Ok(match dgr.group_type {
            crate::types::GroupType::User => {
                let collection = self.db.collection::<FilezUserGroup>("userGroups");

                collection
                    .delete_one(
                        doc! {"_id": dgr.group_id.clone(), "ownerId": owner_id},
                        None,
                    )
                    .await?
            }
            crate::types::GroupType::File => {
                let collection = self.db.collection::<FilezFileGroup>("fileGroups");
                collection
                    .delete_one(
                        doc! {"_id": dgr.group_id.clone(), "ownerId": owner_id},
                        None,
                    )
                    .await?
            }
        })
    }

    pub async fn create_permission(
        &self,
        permission: &FilezPermission,
    ) -> anyhow::Result<InsertOneResult> {
        let collection = self.db.collection::<FilezPermission>("permissions");

        let res = collection.insert_one(permission, None).await?;
        Ok(res)
    }

    pub async fn get_file_groups_by_name(
        &self,
        group_name: &str,
        owner_id: &str,
    ) -> anyhow::Result<Vec<FilezFileGroup>> {
        let collection = self.db.collection::<FilezFileGroup>("fileGroups");

        let file_groups = collection
            .find(doc! {"ownerId": owner_id,"name":group_name}, None)
            .await?
            .try_collect::<Vec<_>>()
            .await?;

        Ok(file_groups)
    }

    pub async fn create_group(&self, group: &FilezGroups) -> anyhow::Result<InsertOneResult> {
        Ok(match group {
            FilezGroups::FilezUserGroup(g) => {
                let collection = self.db.collection::<FilezUserGroup>("userGroups");

                collection.insert_one(g, None).await?
            }
            FilezGroups::FilezFileGroup(g) => {
                let collection = self.db.collection::<FilezFileGroup>("fileGroups");

                collection.insert_one(g, None).await?
            }
        })
    }

    pub async fn set_app_data(&self, sadr: SetAppDataRequest) -> anyhow::Result<UpdateResult> {
        let update_key = format!("appData.{}", sadr.app_name);

        Ok(match sadr.app_data_type {
            AppDataType::User => {
                let collection = self.db.collection::<FilezUser>("users");
                collection
                    .update_one(
                        doc! {"_id":sadr.id},
                        doc! {"$set":{ update_key: bson::to_bson(&sadr.app_data)? }},
                        None,
                    )
                    .await?
            }
            AppDataType::File => {
                let collection = self.db.collection::<FilezFile>("files");
                collection
                    .update_one(
                        doc! {"_id":sadr.id},
                        doc! {"$set":{ update_key: bson::to_bson(&sadr.app_data)? }},
                        None,
                    )
                    .await?
            }
        })
    }

    pub async fn get_aggregated_keywords(&self, owner_id: &str) -> anyhow::Result<Vec<String>> {
        let collection = self.db.collection::<FilezFile>("files");

        let res = collection
            .aggregate(
                vec![
                    doc! {
                        "$match": {
                            "ownerId": owner_id
                        }
                    },
                    doc! {
                        "$unwind": "$keywords"
                    },
                    doc! {
                        "$group": {
                            "_id": "$keywords"
                        }
                    },
                    doc! {
                        "$project": {
                            "_id": 0,
                            "keyword": "$_id"
                        }
                    },
                ],
                None,
            )
            .await?
            .try_collect::<Vec<_>>()
            .await?;

        let mut keywords: Vec<String> = vec![];

        for doc in res {
            keywords.push(doc.get_str("keyword")?.to_string());
        }

        Ok(keywords)
    }

    pub async fn update_file_name(
        &self,
        file_id: &str,
        new_name: &str,
    ) -> anyhow::Result<UpdateResult> {
        let collection = self.db.collection::<FilezFile>("files");
        Ok(collection
            .update_one(
                doc! {"_id":file_id},
                doc! {"$set":{ "name": new_name }},
                None,
            )
            .await?)
    }

    pub async fn update_mime_type(
        &self,
        file_id: &str,
        new_mime_type: &str,
    ) -> anyhow::Result<UpdateResult> {
        let collection = self.db.collection::<FilezFile>("files");
        Ok(collection
            .update_one(
                doc! {"_id":file_id},
                doc! {"$set":{ "mimeType": new_mime_type }},
                None,
            )
            .await?)
    }

    pub async fn update_static_file_group_ids(
        &self,
        file_id: &str,
        new_static_file_group_ids: &Vec<String>,
    ) -> anyhow::Result<UpdateResult> {
        let collection = self.db.collection::<FilezFile>("files");
        Ok(collection
            .update_one(
                doc! {"_id":file_id},
                doc! {"$set":{ "staticFileGroupIds": new_static_file_group_ids }},
                None,
            )
            .await?)
    }

    pub async fn update_keywords(
        &self,
        file_id: &str,
        new_keywords: &Vec<String>,
    ) -> anyhow::Result<UpdateResult> {
        let collection = self.db.collection::<FilezFile>("files");
        Ok(collection
            .update_one(
                doc! {"_id":file_id},
                doc! {"$set":{ "keywords": new_keywords }},
                None,
            )
            .await?)
    }

    pub async fn update_storage_id(
        &self,
        file: &FilezFile,
        new_storage_id: &str,
        new_path: &str,
        user: &FilezUser,
    ) -> anyhow::Result<()> {
        let mut session = self.client.start_session(None).await?;
        session.start_transaction(None).await?;

        let files_collection = self.db.collection::<FilezFile>("files");
        let users_collection = self.db.collection::<FilezUser>("users");

        // set new storage path and id
        files_collection
            .update_one_with_session(
                doc! { "_id": &file.file_id },
                doc! { "$set":{ "storageId": new_storage_id, "path": new_path }},
                None,
                &mut session,
            )
            .await?;

        // update storage usage
        let old_storage_id = some_or_bail!(&file.storage_id, "old storage id is none");
        let old_used_storage_key = format!("limits.{}.usedStorage", old_storage_id);
        let old_file_count_key = format!("limits.{}.fileCount", old_storage_id);

        let new_used_storage_key = format!("limits.{}.usedStorage", new_storage_id);
        let new_file_count_key = format!("limits.{}.fileCount", new_storage_id);

        users_collection
            .update_one_with_session(
                doc! {"_id": &user.user_id },
                doc! {
                    "$inc":{
                        old_used_storage_key: -(file.size as i64),
                        new_used_storage_key: file.size as i64,
                        old_file_count_key: -1,
                        new_file_count_key: 1,
                    }
                },
                None,
                &mut session,
            )
            .await?;

        Ok(session.commit_transaction().await?)
    }

    pub async fn update_pending_new_owner_id(
        &self,
        file_id: &str,
        new_owner_id: &str,
    ) -> anyhow::Result<UpdateResult> {
        let collection = self.db.collection::<FilezFile>("files");
        Ok(collection
            .update_one(
                doc! {"_id":file_id},
                doc! {"$set":{ "pendingNewOwnerId": new_owner_id }},
                None,
            )
            .await?)
    }

    pub async fn get_files_by_group_id(
        &self,
        group_id: &str,
        limit: Option<i64>,
        from_index: u64,
        sort_field: Option<String>,
        sort_order: SortOrder,
        filter: Option<String>,
    ) -> anyhow::Result<(Vec<FilezFile>, u32)> {
        let collection = self.db.collection::<FilezFile>("files");

        let sort_field = sort_field.unwrap_or("name".to_string());

        let find_options = FindOptions::builder()
            .sort(doc! {
                sort_field: match sort_order {
                    SortOrder::Ascending => 1,
                    SortOrder::Descending => -1
                }
            })
            .limit(limit)
            .skip(from_index)
            .build();

        let db_filter = doc! {
            "$and": [
                {
                    "$or": [
                        {"staticFileGroupIds": group_id},
                        {"dynamicFileGroupIds": group_id}
                    ]
                },
                {
                    "$or": [
                        {
                            "name": {
                                "$regex": &filter
                            }
                        },
                        {
                            "_id": &filter
                        },
                        {
                            "ownerId": &filter
                        },
                        {
                            "keywords": {
                                "$regex": &filter
                            }
                        },
                        {
                            "mimeType": {
                                "$regex": &filter
                            }
                        }
                    ]
                },
            ]
        };

        let (files, total_count) = (
            collection
                .find(db_filter.clone(), find_options)
                .await?
                .try_collect::<Vec<_>>()
                .await?,
            collection.count_documents(db_filter, None).await?,
        );

        Ok((files, total_count as u32))
    }

    pub async fn get_user_by_id(&self, user_id: &str) -> anyhow::Result<Option<FilezUser>> {
        let collection = self.db.collection::<FilezUser>("users");
        let user = collection.find_one(doc! {"_id": user_id}, None).await?;
        Ok(user)
    }

    pub async fn get_file_by_id(&self, file_id: &str) -> anyhow::Result<Option<FilezFile>> {
        let collection = self.db.collection::<FilezFile>("files");
        let file = collection.find_one(doc! {"_id": file_id}, None).await?;
        Ok(file)
    }

    pub async fn get_file_by_path(&self, file_path: &str) -> anyhow::Result<Option<FilezFile>> {
        let collection = self.db.collection::<FilezFile>("files");
        let file = collection.find_one(doc! {"path": file_path}, None).await?;
        Ok(file)
    }

    pub async fn check_file_group_existence(
        &self,
        static_file_group_ids: &Vec<String>,
    ) -> anyhow::Result<()> {
        let collection = self.db.collection::<FilezFileGroup>("fileGroups");

        let cursor = collection
            .find(
                doc! {
                    "_id": {
                        "$in": static_file_group_ids.clone()
                    }
                },
                None,
            )
            .await?;

        if cursor.count().await != static_file_group_ids.len() {
            bail!("Some file groups do not exist");
        }

        Ok(())
    }

    pub async fn get_permissions_from_file(
        &self,
        file: &FilezFile,
    ) -> anyhow::Result<Vec<FilezPermission>> {
        let mut permissions = vec![];

        // TODO check groups permissions

        // get the permission from the permission ids of the file
        if !file.permission_ids.is_empty() {
            let collection = self.db.collection::<FilezPermission>("permissions");

            let mut cursor = collection
                .find(
                    doc! {
                        "_id": {
                            "$in": file.permission_ids.clone()
                        }
                    },
                    None,
                )
                .await?;

            while let Some(permission) = cursor.try_next().await? {
                permissions.push(permission);
            }
        }

        Ok(permissions)
    }

    pub async fn delete_file_by_id(&self, file: &FilezFile) -> anyhow::Result<()> {
        if file.readonly {
            bail!("file is readonly");
        }
        let mut session = self.client.start_session(None).await?;
        session.start_transaction(None).await?;

        let files_collection = self.db.collection::<FilezFile>("files");
        let files_groups_collection = self.db.collection::<FilezFileGroup>("fileGroups");
        let users_collection = self.db.collection::<FilezUser>("users");

        let file = some_or_bail!(
            files_collection
                .find_one(
                    doc! {
                        "_id": file.file_id.clone()
                    },
                    None
                )
                .await?,
            "file not found"
        );

        // delete file
        files_collection
            .delete_one_with_session(doc! {"_id": file.file_id}, None, &mut session)
            .await?;

        // update user
        let fsid = some_or_bail!(
            file.storage_id,
            "The to be deleted file has no associated storage id"
        );
        let user_key_used_storage = format!("limits.{}.usedStorage", fsid);
        let user_key_used_files = format!("limits.{}.usedFiles", fsid);

        users_collection
            .update_one_with_session(
                doc! {
                    "_id": file.owner_id
                },
                doc! {
                    "$inc": {
                        user_key_used_storage: -(file.size as i64),
                        user_key_used_files: -1
                    }
                },
                None,
                &mut session,
            )
            .await?;

        // update file groups
        // decrease item count for all groups that are assigned to the file
        for group in file.static_file_group_ids {
            files_groups_collection
                .update_one_with_session(
                    doc! {
                        "_id": group
                    },
                    doc! {
                        "$inc": {
                            "itemCount": -1
                        }
                    },
                    None,
                    &mut session,
                )
                .await?;
        }

        for group in file.dynamic_file_group_ids {
            files_groups_collection
                .update_one_with_session(
                    doc! {
                        "_id": group
                    },
                    doc! {
                        "$inc": {
                            "itemCount": -1
                        }
                    },
                    None,
                    &mut session,
                )
                .await?;
        }

        Ok(session.commit_transaction().await?)
    }

    pub async fn update_file_with_content_change(
        &self,
        old_file: &FilezFile,
        new_sha256: &str,
        new_size: u64,
        new_modified: i64,
    ) -> anyhow::Result<()> {
        let mut session = self.client.start_session(None).await?;
        session.start_transaction(None).await?;

        let files_collection = self.db.collection::<FilezFile>("files");

        let users_collection = self.db.collection::<FilezUser>("users");

        // update user
        let fsid = some_or_bail!(
            old_file.storage_id.clone(),
            "The to be deleted file has no associated storage id"
        );
        let user_key_used_storage = format!("limits.{}.usedStorage", fsid);

        let inc_value = new_size as i64 - old_file.size as i64;

        users_collection
            .update_one_with_session(
                doc! {
                    "_id": old_file.owner_id.clone()
                },
                doc! {
                    "$inc": {
                        user_key_used_storage: inc_value,
                    }
                },
                None,
                &mut session,
            )
            .await?;

        // update file
        files_collection
            .update_one_with_session(
                doc! {
                    "_id": old_file.file_id.clone()
                },
                doc! {
                    "$set": {
                        "sha256": new_sha256,
                        "size": new_size as i64,
                        "modified": new_modified
                    }
                },
                None,
                &mut session,
            )
            .await?;

        Ok(session.commit_transaction().await?)
    }

    pub async fn create_file(
        &self,
        file: FilezFile,
        ignore_user_limit: bool,
    ) -> anyhow::Result<()> {
        let mut session = self.client.start_session(None).await?;

        session.start_transaction(None).await?;

        let files_groups_collection = self.db.collection::<FilezFileGroup>("fileGroups");
        let files_collection = self.db.collection::<FilezFile>("files");
        let users_collection = self.db.collection::<FilezUser>("users");

        // update user

        if !ignore_user_limit {
            let fsid = some_or_bail!(
                file.storage_id.clone(),
                "The to be created file has no associated storage id"
            );
            let user_key_used_storage = format!("limits.{}.usedStorage", fsid);
            let user_key_used_files = format!("limits.{}.usedFiles", fsid);
            users_collection
                .update_one_with_session(
                    doc! {
                        "_id": &file.owner_id
                    },
                    doc! {
                        "$inc": {
                            user_key_used_storage: file.size as i64,
                            user_key_used_files: 1
                        }
                    },
                    None,
                    &mut session,
                )
                .await?;
        }
        for group_id in &file.static_file_group_ids {
            files_groups_collection
                .update_one_with_session(
                    doc! {
                        "_id": group_id
                    },
                    doc! {
                        "$inc": {
                            "itemCount": 1
                        }
                    },
                    None,
                    &mut session,
                )
                .await?;
        }
        /*
                for group_id in &file.dynamic_file_group_ids {
                    files_groups_collection
                        .update_one_with_session(
                            doc! {
                                "_id": group_id
                            },
                            doc! {
                                "$inc": {
                                    "itemCount": 1
                                }
                            },
                            None,
                            &mut session,
                        )
                        .await?;
                }
        */
        // create file
        files_collection
            .insert_one_with_session(file, None, &mut session)
            .await?;

        Ok(session.commit_transaction().await?)
    }
}
