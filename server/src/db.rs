use crate::{
    config::SERVER_CONFIG,
    dynamic_groups::GroupChange,
    methods::{
        set_app_data::SetAppDataRequest,
        update_permission_ids_on_resource::UpdatePermissionIdsOnResourceRequestBody,
    },
    permissions::{FilezPermission, PermissionResourceSelectType},
    some_or_bail,
    utils::generate_id,
};
use filez_common::server::{
    AppDataType, FileGroupType, FileResourceType, FilezFile, FilezFileGroup, FilezUser,
    FilezUserGroup, GetItemListRequestBody, SortOrder, UploadSpace, UsageLimits, UserRole,
    UserStatus, Visibility,
};

use anyhow::bail;
use futures::{stream::TryStreamExt, StreamExt};
use mongodb::{
    bson::doc,
    options::{FindOneOptions, FindOptions},
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
            "user_groups",
            "file_groups",
            "upload_spaces",
        ];

        for collection in collections {
            let _ = self.db.create_collection(collection, None).await;
        }

        let files_collection = self.db.collection::<FilezFile>("files");

        //files_collection.drop_indexes(None).await?;

        {
            let index = IndexModel::builder()
                .keys(doc! {"static_file_group_ids": 1})
                .build();
            match files_collection.create_index(index, None).await {
                Ok(_) => {}
                Err(e) => println!("Error creating index on files collection: {:?}", e),
            };
        }
        {
            let index = IndexModel::builder()
                .keys(doc! {"dynamic_file_group_ids": 1})
                .build();
            match files_collection.create_index(index, None).await {
                Ok(_) => {}
                Err(e) => println!("Error creating index on files collection: {:?}", e),
            };
        }
        {
            let index = IndexModel::builder().keys(doc! {"keywords": 1}).build();
            match files_collection.create_index(index, None).await {
                Ok(_) => {}
                Err(e) => println!("Error creating index on files collection: {:?}", e),
            };
        }
        {
            let index = IndexModel::builder().keys(doc! {"owner_id": 1}).build();
            match files_collection.create_index(index, None).await {
                Ok(_) => {}
                Err(e) => println!("Error creating index on files collection: {:?}", e),
            };
        }

        let user_collection = self.db.collection::<FilezUser>("users");

        //user_collection.drop_indexes(None).await?;

        {
            let index = IndexModel::builder().keys(doc! {"ir_user_id": 1}).build();
            match user_collection.create_index(index, None).await {
                Ok(_) => {}
                Err(e) => println!("Error creating index on users collection: {:?}", e),
            };
        }

        Ok(())
    }

    pub async fn get_upload_space_by_token(
        &self,
        upload_space_id: &str,
    ) -> anyhow::Result<Option<UploadSpace>> {
        let collection = self.db.collection::<UploadSpace>("upload_spaces");
        let res = collection
            .find_one(
                doc! {
                    "_id": upload_space_id
                },
                None,
            )
            .await?;

        Ok(res)
    }

    pub async fn create_upload_space(&self, upload_space: &UploadSpace) -> anyhow::Result<()> {
        let collection = self.db.collection::<UploadSpace>("upload_spaces");
        collection.insert_one(upload_space, None).await?;

        Ok(())
    }

    pub async fn update_file_group(&self, file_group: &FilezFileGroup) -> anyhow::Result<()> {
        let collection = self.db.collection::<FilezFileGroup>("file_groups");
        collection
            .update_one(
                doc! {
                    "_id": file_group.file_group_id.clone()
                },
                doc! {
                    "$set": bson::to_bson(file_group)?
                },
                None,
            )
            .await?;

        Ok(())
    }

    pub async fn get_dynamic_groups_by_owner_id(
        &self,
        owner_id: &str,
    ) -> anyhow::Result<Vec<FilezFileGroup>> {
        let collection = self.db.collection::<FilezFileGroup>("file_groups");
        let res = collection
            .find(
                doc! {
                "$and":[
                    {
                        "owner_id": {
                            "$eq":owner_id
                        }
                    },
                    {
                        "group_type": {
                            "$eq": "Dynamic"
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

    pub async fn update_dynamic_file_groups_on_many_files(
        &self,
        to_be_updated: &Vec<GroupChange>,
    ) -> anyhow::Result<()> {
        let mut session = self.client.start_session(None).await?;
        session.start_transaction(None).await?;

        let files_collection = self.db.collection::<FilezFile>("files");
        let file_groups_collection = self.db.collection::<FilezFileGroup>("file_groups");

        let mut file_count_map: HashMap<String, i64> = HashMap::new();

        for tba in to_be_updated {
            let file_id = &tba.file_id;
            let added_groups = &tba.added_groups;
            let removed_groups = &tba.removed_groups;

            for file_group_id in added_groups {
                if file_count_map.contains_key(file_group_id) {
                    let count = file_count_map.get(file_group_id).unwrap();
                    file_count_map.insert(file_group_id.clone(), count + 1);
                } else {
                    file_count_map.insert(file_group_id.clone(), 1);
                }
            }

            if !added_groups.is_empty() {
                files_collection
                    .update_one_with_session(
                        doc! {
                            "_id": file_id
                        },
                        doc! {
                            "$push": {
                                "dynamic_file_group_ids": {
                                    "$each": &added_groups
                                }
                            }
                        },
                        None,
                        &mut session,
                    )
                    .await?;
            }

            for file_group_id in removed_groups {
                if file_count_map.contains_key(file_group_id) {
                    let count = file_count_map.get(file_group_id).unwrap();
                    file_count_map.insert(file_group_id.clone(), count - 1);
                } else {
                    file_count_map.insert(file_group_id.clone(), -1);
                }
            }

            if !removed_groups.is_empty() {
                files_collection
                    .update_one_with_session(
                        doc! {
                            "_id": file_id
                        },
                        doc! {
                            "$pull": {
                                "dynamic_file_group_ids": {
                                    "$in": &removed_groups
                                }
                            }
                        },
                        None,
                        &mut session,
                    )
                    .await?;
            }
        }

        dbg!(&file_count_map);

        //set the new file count on the groups
        for (file_group_id, file_count) in file_count_map {
            file_groups_collection
                .update_one_with_session(
                    doc! {
                        "_id": file_group_id
                    },
                    doc! {
                        "$inc": {
                            "item_count": bson::to_bson(&file_count)?
                        }
                    },
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
            .find(
                doc! {
                    "owner_id": owner_id
                },
                FindOptions::builder().build(),
            )
            .await?
            .try_collect::<Vec<_>>()
            .await?;

        Ok(res)
    }

    pub async fn update_permission_ids_on_resource(
        &self,
        upr: &UpdatePermissionIdsOnResourceRequestBody,
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
            FileResourceType::FileGroup => {
                let group = some_or_bail!(
                    self.get_file_group_by_id(&upr.resource_id).await?,
                    "Could not find file group"
                );
                if group.owner_id != user_id {
                    bail!("You do not own this FileGroup");
                }

                let collection = self.db.collection::<FilezFileGroup>("file_groups");
                // update permissions on the file group

                collection
                    .update_one(
                        doc! {
                            "_id": group.file_group_id
                        },
                        doc! {
                            "$set": {
                                "permission_ids": upr.permission_ids.clone()
                            }
                        },
                        None,
                    )
                    .await?
            }
            FileResourceType::File => {
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
                        doc! {
                            "_id": file.file_id
                        },
                        doc! {
                            "$set": {
                                "permission_ids": upr.permission_ids.clone()
                            }
                        },
                        None,
                    )
                    .await?
            }
        })
    }

    pub async fn get_permission_by_id(
        &self,
        permission_id: &str,
    ) -> anyhow::Result<Option<FilezPermission>> {
        let collection = self.db.collection::<FilezPermission>("permissions");
        let res = collection
            .find_one(doc! {"_id": permission_id}, None)
            .await?;

        Ok(res)
    }

    pub async fn update_permission(&self, permission: &FilezPermission) -> anyhow::Result<()> {
        let collection = self.db.collection::<FilezPermission>("permissions");
        collection
            .update_one(
                doc! {
                    "_id": permission.permission_id.clone()
                },
                doc! {
                    "$set": bson::to_bson(permission)?
                },
                None,
            )
            .await?;

        Ok(())
    }

    pub async fn get_permissions_by_owner_id(
        &self,
        owner_id: &str,
    ) -> anyhow::Result<Vec<FilezPermission>> {
        let collection = self.db.collection::<FilezPermission>("permissions");
        let permissions = collection
            .find(
                doc! {
                    "owner_id": owner_id
                },
                None,
            )
            .await?
            .try_collect::<Vec<_>>()
            .await?;
        Ok(permissions)
    }

    pub async fn get_permissions_by_owner_id_for_virtual_list(
        &self,
        owner_id: &str,
        gir: &GetItemListRequestBody,
        permission_type: Option<PermissionResourceSelectType>,
    ) -> anyhow::Result<(Vec<FilezPermission>, u32)> {
        let collection = self.db.collection::<FilezPermission>("permissions");

        let sort_field = gir.sort_field.clone().unwrap_or("_id".to_string());
        let find_options = FindOptions::builder()
            .sort(doc! {
                sort_field: match gir.sort_order {
                    Some(SortOrder::Ascending) => 1,
                    Some(SortOrder::Descending) => -1,
                    None => 1
            }
            })
            .limit(gir.limit.map(|l| l as i64))
            .skip(gir.from_index)
            .build();

        let search_filter = match &gir.filter {
            Some(f) => {
                if !f.is_empty() {
                    doc! {
                        "$or": [
                            {
                                "_id": &f
                            },
                            {
                                "name": {
                                    "$regex": &f
                                }
                            },
                        ]
                    }
                } else {
                    doc! {}
                }
            }
            None => doc! {},
        };

        let permission_resource_type_filter = match permission_type {
            Some(pt) => doc! {
                "resource_type": match pt {
                    PermissionResourceSelectType::File => "File",
                    PermissionResourceSelectType::FileGroup => "FileGroup",
                    PermissionResourceSelectType::User => "User",
                    PermissionResourceSelectType::UserGroup => "UserGroup",
                }
            },
            None => doc! {},
        };

        let db_filter = doc! {
            "$and": [
                search_filter,
                {
                    "owner_id": owner_id
                },
                permission_resource_type_filter
            ]
        };

        let (items, total_count) = (
            collection
                .find(db_filter.clone(), find_options)
                .await?
                .try_collect::<Vec<_>>()
                .await?,
            collection.count_documents(db_filter, None).await?,
        );

        Ok((items, total_count as u32))
    }

    pub async fn get_file_group_by_id(
        &self,
        file_group_id: &str,
    ) -> anyhow::Result<Option<FilezFileGroup>> {
        let collection = self.db.collection::<FilezFileGroup>("file_groups");

        let res = collection
            .find_one(doc! {"_id": file_group_id}, None)
            .await?;

        Ok(res)
    }

    pub async fn link_ir_user(
        &self,
        user_id: &str,
        ir_user_id: &str,
    ) -> anyhow::Result<UpdateResult> {
        let collection = self.db.collection::<FilezUser>("users");

        Ok(collection
            .update_one(
                doc! {
                    "_id": user_id
                },
                doc! {
                    "$set": {
                        "ir_user_id": ir_user_id,
                        "status": "Active",
                    }
                },
                None,
            )
            .await?)
    }

    pub async fn create_user(
        &self,
        ir_user_id: Option<String>,
        user_status: Option<UserStatus>,
        user_name: Option<String>,
        email: Option<String>,
    ) -> anyhow::Result<String> {
        let mut session = self.client.start_session(None).await?;
        session.start_transaction(None).await?;

        let users_collection = self.db.collection::<FilezUser>("users");
        let config = &SERVER_CONFIG;

        let mut limits: HashMap<String, Option<UsageLimits>> = HashMap::new();

        for (storage_name, storage_config) in &config.storage.storages {
            let l = storage_config
                .default_user_limits
                .as_ref()
                .map(|dul| UsageLimits {
                    max_storage: dul.max_storage,
                    used_storage: 0,
                    max_files: dul.max_files,
                    used_files: 0,
                    max_bandwidth: dul.max_bandwidth,
                    used_bandwidth: 0,
                });
            limits.insert(storage_name.to_string(), l);
        }

        let user_id = generate_id(16);

        let make_admin = match &email {
            Some(m) => config.users.make_admin.contains(m),
            None => false,
        };

        let user = FilezUser {
            user_id: user_id.clone(),
            ir_user_id,
            app_data: HashMap::new(),
            limits,
            user_group_ids: vec![],
            friends: vec![],
            name: user_name,
            pending_incoming_friend_requests: vec![],
            status: user_status.unwrap_or(UserStatus::Active),
            visibility: Visibility::Public,
            email,
            role: match make_admin {
                true => UserRole::Admin,
                false => UserRole::User,
            },
            permission_ids: vec![],
        };

        users_collection
            .insert_one_with_session(&user, None, &mut session)
            .await?;

        let file_groups_collection = self.db.collection::<FilezFileGroup>("file_groups");

        file_groups_collection
            .insert_one_with_session(
                &FilezFileGroup {
                    file_group_id: format!("{}_all", &user_id),
                    owner_id: user_id.to_string(),
                    name: Some("All".to_string()),
                    permission_ids: vec![],
                    keywords: vec![],
                    mime_types: vec![],
                    group_hierarchy_paths: vec![],
                    group_type: FileGroupType::Static,
                    dynamic_group_rules: None,
                    item_count: 0,
                    readonly: true,
                },
                None,
                &mut session,
            )
            .await?;
        session.commit_transaction().await?;

        Ok(user_id.clone())
    }

    pub async fn get_file_groups_by_owner_id(
        &self,
        owner_id: &str,
    ) -> anyhow::Result<Vec<FilezFileGroup>> {
        let collection = self.db.collection::<FilezFileGroup>("file_groups");

        let file_groups = collection
            .find(
                doc! {
                    "owner_id": owner_id
                },
                None,
            )
            .await?
            .try_collect::<Vec<_>>()
            .await?;

        Ok(file_groups)
    }

    pub async fn get_file_groups_by_owner_id_for_virtual_list(
        &self,
        owner_id: &str,
        gir: &GetItemListRequestBody,
        group_type: Option<FileGroupType>,
    ) -> anyhow::Result<(Vec<FilezFileGroup>, u32)> {
        let collection = self.db.collection::<FilezFileGroup>("file_groups");

        let sort_field = gir.sort_field.clone().unwrap_or("_id".to_string());

        let find_options = FindOptions::builder()
            .sort(doc! {
                sort_field: match gir.sort_order {
                        Some(SortOrder::Ascending) => 1,
                        Some(SortOrder::Descending) => -1,
                        None => 1
                }
            })
            .limit(gir.limit.map(|l| l as i64))
            .skip(gir.from_index)
            .build();

        let search_filter = match &gir.filter {
            Some(f) => {
                if !f.is_empty() {
                    doc! {
                        "$or": [
                            {
                                "_id": &f
                            },
                            {
                                "name": {
                                    "$regex": &f
                                }
                            },
                        ]
                    }
                } else {
                    doc! {}
                }
            }
            None => doc! {},
        };

        let group_type_filter = match group_type {
            Some(gt) => doc! {
                "group_type": match gt {
                    FileGroupType::Static => "Static",
                    FileGroupType::Dynamic => "Dynamic"
                }
            },
            None => doc! {},
        };

        let db_filter = doc! {
            "$and":[
                search_filter,
                {
                    "owner_id": owner_id
                },
                group_type_filter
            ]
        };

        let (items, total_count) = (
            collection
                .find(db_filter.clone(), find_options)
                .await?
                .try_collect::<Vec<_>>()
                .await?,
            collection.count_documents(db_filter, None).await?,
        );

        Ok((items, total_count as u32))
    }

    pub async fn get_user_group_by_id(
        &self,
        user_group_id: &str,
    ) -> anyhow::Result<Option<FilezUserGroup>> {
        let collection = self.db.collection::<FilezUserGroup>("user_groups");

        let res = collection
            .find_one(
                doc! {
                    "_id": user_group_id
                },
                None,
            )
            .await?;

        Ok(res)
    }

    pub async fn delete_permission(&self, permission_id: &str) -> anyhow::Result<DeleteResult> {
        let collection = self.db.collection::<FilezPermission>("permissions");

        Ok(collection
            .delete_one(
                doc! {
                    "_id": permission_id,
                },
                None,
            )
            .await?)
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
        let collection = self.db.collection::<FilezFileGroup>("file_groups");

        let file_groups = collection
            .find(
                doc! {
                    "owner_id": owner_id,
                    "name": group_name
                },
                None,
            )
            .await?
            .try_collect::<Vec<_>>()
            .await?;

        Ok(file_groups)
    }

    pub async fn create_user_group(
        &self,
        user_group: &FilezUserGroup,
    ) -> anyhow::Result<InsertOneResult> {
        let collection = self.db.collection::<FilezUserGroup>("user_groups");

        let res = collection.insert_one(user_group, None).await?;
        Ok(res)
    }

    pub async fn update_user_group(&self, user_group: &FilezUserGroup) -> anyhow::Result<()> {
        let collection = self.db.collection::<FilezUserGroup>("user_groups");
        collection
            .update_one(
                doc! {
                    "_id": &user_group.user_group_id
                },
                doc! {
                    "$set": bson::to_bson(user_group)?
                },
                None,
            )
            .await?;

        Ok(())
    }

    pub async fn create_file_group(
        &self,
        file_group: &FilezFileGroup,
    ) -> anyhow::Result<InsertOneResult> {
        let collection = self.db.collection::<FilezFileGroup>("file_groups");

        let res = collection.insert_one(file_group, None).await?;
        Ok(res)
    }

    pub async fn set_app_data(&self, sadr: SetAppDataRequest) -> anyhow::Result<UpdateResult> {
        let update_key = format!("app_data.{}", sadr.app_name);

        Ok(match sadr.app_data_type {
            AppDataType::User => {
                let collection = self.db.collection::<FilezUser>("users");
                collection
                    .update_one(
                        doc! {
                            "_id": sadr.id
                        },
                        doc! {
                            "$set":{
                                update_key: bson::to_bson(&sadr.app_data)?
                            }
                        },
                        None,
                    )
                    .await?
            }
            AppDataType::File => {
                let collection = self.db.collection::<FilezFile>("files");
                collection
                    .update_one(
                        doc! {
                            "_id": sadr.id
                        },
                        doc! {
                            "$set":{
                                update_key: bson::to_bson(&sadr.app_data)?
                            }
                        },
                        None,
                    )
                    .await?
            }
        })
    }

    // TODO make this work for all types of resources that can have keywords
    pub async fn get_aggregated_keywords(&self, owner_id: &str) -> anyhow::Result<Vec<String>> {
        let collection = self.db.collection::<FilezFile>("files");

        let res = collection
            .aggregate(
                vec![
                    doc! {
                        "$match": {
                            "owner_id": owner_id
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

    pub async fn get_all_users(&self) -> anyhow::Result<Vec<FilezUser>> {
        let collection = self.db.collection::<FilezUser>("users");

        let res = collection
            .find(doc! {}, None)
            .await?
            .try_collect::<Vec<_>>()
            .await?;

        Ok(res)
    }

    pub async fn update_user_limits(
        &self,
        user_id: &str,
        limits: &HashMap<String, Option<UsageLimits>>,
    ) -> anyhow::Result<()> {
        let collection = self.db.collection::<FilezUser>("users");

        collection
            .update_one(
                doc! {
                    "_id": user_id
                },
                doc! {
                    "$set": {
                        "limits": bson::to_bson(&limits)?
                    }
                },
                None,
            )
            .await?;

        Ok(())
    }

    pub async fn update_file_name(
        &self,
        file_id: &str,
        new_name: &str,
    ) -> anyhow::Result<UpdateResult> {
        let collection = self.db.collection::<FilezFile>("files");
        Ok(collection
            .update_one(
                doc! {
                    "_id":file_id
                },
                doc! {
                    "$set": {
                        "name": new_name
                    }
                },
                None,
            )
            .await?)
    }

    pub async fn update_file_mime_type(
        &self,
        file_id: &str,
        new_mime_type: &str,
    ) -> anyhow::Result<UpdateResult> {
        let collection = self.db.collection::<FilezFile>("files");
        Ok(collection
            .update_one(
                doc! {
                    "_id": file_id
                },
                doc! {
                    "$set": {
                        "mime_type": new_mime_type
                    }
                },
                None,
            )
            .await?)
    }

    pub async fn update_files_static_file_group_ids(
        &self,
        file_id: &str,
        old_static_file_group_ids: &Vec<String>,
        new_static_file_group_ids: &Vec<String>,
    ) -> anyhow::Result<()> {
        let files_collection = self.db.collection::<FilezFile>("files");
        let static_file_groups_collection = self.db.collection::<FilezFileGroup>("file_groups");

        let mut session = self.client.start_session(None).await?;
        session.start_transaction(None).await?;

        files_collection
            .update_one_with_session(
                doc! {
                    "_id": file_id
                },
                doc! {
                    "$set": {
                        "static_file_group_ids": new_static_file_group_ids
                    }
                },
                None,
                &mut session,
            )
            .await?;

        static_file_groups_collection
            .update_many_with_session(
                doc! {
                    "_id": {
                        "$in": old_static_file_group_ids
                    }
                },
                doc! {
                    "$inc": {
                        "item_count": -1
                    }
                },
                None,
                &mut session,
            )
            .await?;

        static_file_groups_collection
            .update_many_with_session(
                doc! {
                    "_id": {
                        "$in": new_static_file_group_ids
                    }
                },
                doc! {
                    "$inc": {
                        "item_count": 1
                    }
                },
                None,
                &mut session,
            )
            .await?;

        Ok(session.commit_transaction().await?)
    }

    pub async fn update_file_keywords(
        &self,
        file_id: &str,
        new_keywords: &Vec<String>,
    ) -> anyhow::Result<UpdateResult> {
        let collection = self.db.collection::<FilezFile>("files");
        Ok(collection
            .update_one(
                doc! {
                    "_id": file_id
                },
                doc! {
                    "$set": {
                        "keywords": new_keywords
                    }
                },
                None,
            )
            .await?)
    }

    pub async fn update_file_storage_id(
        &self,
        file: &FilezFile,
        new_storage_id: &str,
        user: &FilezUser,
    ) -> anyhow::Result<()> {
        let mut session = self.client.start_session(None).await?;
        session.start_transaction(None).await?;

        let files_collection = self.db.collection::<FilezFile>("files");
        let users_collection = self.db.collection::<FilezUser>("users");

        // set new storage path and id
        files_collection
            .update_one_with_session(
                doc! {
                    "_id": &file.file_id
                },
                doc! {
                    "$set": {
                        "storage_id": new_storage_id,
                    }
                },
                None,
                &mut session,
            )
            .await?;

        // update storage usage
        let old_storage_id = some_or_bail!(&file.storage_id, "old storage id is none");
        let old_used_storage_key = format!("limits.{}.used_storage", old_storage_id);
        let old_file_count_key = format!("limits.{}.file_count", old_storage_id);

        let new_used_storage_key = format!("limits.{}.used_storage", new_storage_id);
        let new_file_count_key = format!("limits.{}.file_count", new_storage_id);

        users_collection
            .update_one_with_session(
                doc! {
                    "_id": &user.user_id
                },
                doc! {
                    "$inc": {
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
                doc! {
                    "_id":file_id
                },
                doc! {
                    "$set": {
                         "pending_new_owner_id": new_owner_id
                    }
                },
                None,
            )
            .await?)
    }

    pub async fn update_file_permission_ids(
        &self,
        file_id: &str,
        new_permission_ids: &Vec<String>,
    ) -> anyhow::Result<UpdateResult> {
        let collection = self.db.collection::<FilezFile>("files");
        Ok(collection
            .update_one(
                doc! {
                    "_id":file_id
                },
                doc! {
                    "$set":{
                        "permission_ids": new_permission_ids
                    }
                },
                None,
            )
            .await?)
    }

    pub async fn get_user_group_list(
        &self,
        requesting_user: &FilezUser,
        gir: &GetItemListRequestBody,
    ) -> anyhow::Result<(Vec<FilezUserGroup>, u32)> {
        let collection = self.db.collection::<FilezUserGroup>("user_groups");
        let requesting_user_id = &requesting_user.user_id;
        let requesting_user_user_groups = &requesting_user.user_group_ids;
        let sort_field = gir.sort_field.clone().unwrap_or("_id".to_string());
        let find_options = FindOptions::builder()
            .sort(doc! {
                sort_field: match gir.sort_order {
                    Some(SortOrder::Ascending) => 1,
                    Some(SortOrder::Descending) => -1,
                    None => 1
            }
            })
            .limit(gir.limit.map(|l| l as i64))
            .skip(gir.from_index)
            .build();

        let search_filter = match &gir.filter {
            Some(f) => {
                if !f.is_empty() {
                    doc! {
                        "$or": [
                            {
                                "_id": &f
                            },
                            {
                                "name": {
                                    "$regex": &f
                                }
                            },
                        ]
                    }
                } else {
                    doc! {}
                }
            }
            None => doc! {},
        };

        let db_filter = doc! {
            "$and":[
                search_filter,
                {
                    "$or":[
                        {
                            "owner_id": requesting_user_id
                        },
                        {
                            "visibility": "Public"
                        },
                        {
                            "_id": {
                                "$in": requesting_user_user_groups
                            }
                        }
                    ]
                }
            ]
        };

        let (user_groups, total_count) = (
            collection
                .find(db_filter.clone(), find_options)
                .await?
                .try_collect::<Vec<_>>()
                .await?,
            collection.count_documents(db_filter, None).await?,
        );

        Ok((user_groups, total_count as u32))
    }

    pub async fn get_user_list(
        &self,
        requesting_user: &FilezUser,
        gir: &GetItemListRequestBody,
    ) -> anyhow::Result<(Vec<FilezUser>, u32)> {
        let collection = self.db.collection::<FilezUser>("users");

        let requesting_user_id = &requesting_user.user_id;

        let sort_field = gir.sort_field.clone().unwrap_or("_id".to_string());
        let find_options = FindOptions::builder()
            .sort(doc! {
                sort_field: match gir.sort_order {
                    Some(SortOrder::Ascending) => 1,
                    Some(SortOrder::Descending) => -1,
                    None => 1
            }
            })
            .limit(gir.limit.map(|l| l as i64))
            .skip(gir.from_index)
            .build();

        let search_filter = match &gir.filter {
            Some(f) => {
                if !f.is_empty() {
                    doc! {
                        "$or": [
                            {
                                "_id": &f
                            },
                            {
                                "name": {
                                    "$regex": &f
                                }
                            },
                            {
                                "email": {
                                    "$regex": &f
                                }
                            },

                        ]
                    }
                } else {
                    doc! {}
                }
            }
            None => doc! {},
        };

        let visible = match requesting_user.role {
            UserRole::Admin => {
                doc! {}
            }
            UserRole::User => {
                doc! {
                    "$or":[
                        {
                            "$and":[
                                {
                                    "visibility": {
                                        "$eq": "Public"
                                    }
                                },
                                {
                                    "status": {
                                        "$eq": "Active"
                                    }
                                }

                            ]
                        },
                        {
                            "friends": requesting_user_id
                        }
                    ]
                }
            }
        };

        let db_filter = doc! {
            "$and":[
                search_filter,
                {
                    "_id": {
                        "$ne": requesting_user_id
                    }
                },
                visible
            ]
        };

        let (users, total_count) = (
            collection
                .find(db_filter.clone(), find_options)
                .await?
                .try_collect::<Vec<_>>()
                .await?,
            collection.count_documents(db_filter, None).await?,
        );

        Ok((users, total_count as u32))
    }

    pub async fn get_files_by_group_id(
        &self,
        group_id: &str,
        gir: &GetItemListRequestBody,
    ) -> anyhow::Result<(Vec<FilezFile>, u32)> {
        let collection = self.db.collection::<FilezFile>("files");

        let sort_field = gir.sort_field.clone().unwrap_or("_id".to_string());
        let find_options = FindOptions::builder()
            .sort(doc! {
                sort_field: match gir.sort_order {
                    Some(SortOrder::Ascending) => 1,
                    Some(SortOrder::Descending) => -1,
                    None => 1
            }
            })
            .limit(gir.limit.map(|l| l as i64))
            .skip(gir.from_index)
            .build();

        let search_filter = match &gir.filter {
            Some(f) => doc! {
                "$or": [
                    {
                        "name": {
                            "$regex": &f
                        }
                    },
                    {
                        "_id": &f
                    },
                    {
                        "owner_id": &f
                    },
                    {
                        "keywords": {
                            "$regex": &f
                        }
                    },
                    {
                        "mime_type": {
                            "$regex": &f
                        }
                    }
                ]
            },
            None => doc! {},
        };

        let db_filter = doc! {
            "$and": [
                {
                    "$or": [
                        {
                            "static_file_group_ids": &group_id
                        },
                        {
                            "dynamic_file_group_ids": &group_id
                        }
                    ]
                },
                search_filter,
            ]
        };

        let (items, total_count) = (
            collection
                .find(db_filter.clone(), find_options)
                .await?
                .try_collect::<Vec<_>>()
                .await?,
            collection.count_documents(db_filter, None).await?,
        );
        Ok((items, total_count as u32))
    }

    pub async fn get_user_by_id(&self, user_id: &str) -> anyhow::Result<Option<FilezUser>> {
        let collection = self.db.collection::<FilezUser>("users");
        let user = collection.find_one(doc! {"_id": user_id}, None).await?;
        Ok(user)
    }

    pub async fn get_user_id_by_ir_id(&self, ir_user_id: &str) -> anyhow::Result<Option<String>> {
        use serde::{Deserialize, Serialize};
        #[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
        pub struct OnlyId {
            pub _id: String,
        }

        let collection = self.db.collection::<OnlyId>("users");
        let find_options = FindOneOptions::builder()
            .projection(doc! {"_id": 1})
            .build();

        let user = collection
            .find_one(doc! {"ir_user_id": ir_user_id}, find_options)
            .await?;

        Ok(user.map(|u| u._id))
    }

    pub async fn get_user_by_ir_id(&self, ir_user_id: &str) -> anyhow::Result<Option<FilezUser>> {
        let collection = self.db.collection::<FilezUser>("users");
        let user = collection
            .find_one(doc! {"ir_user_id": ir_user_id}, None)
            .await?;
        Ok(user)
    }

    pub async fn get_user_by_email(&self, email: &str) -> anyhow::Result<Option<FilezUser>> {
        let collection = self.db.collection::<FilezUser>("users");
        let user = collection.find_one(doc! {"email": email}, None).await?;
        Ok(user)
    }

    pub async fn get_file_by_id(&self, file_id: &str) -> anyhow::Result<Option<FilezFile>> {
        let collection = self.db.collection::<FilezFile>("files");
        let file = collection.find_one(doc! {"_id": file_id}, None).await?;
        Ok(file)
    }

    pub async fn get_files_by_ids(&self, file_ids: &Vec<String>) -> anyhow::Result<Vec<FilezFile>> {
        let collection = self.db.collection::<FilezFile>("files");
        let mut cursor = collection
            .find(
                doc! {
                    "_id": {
                        "$in": file_ids
                    }
                },
                None,
            )
            .await?;

        let mut files = vec![];

        while let Some(file) = cursor.try_next().await? {
            files.push(file);
        }

        Ok(files)
    }

    pub async fn get_file_by_readonly_path(&self, path: &str) -> anyhow::Result<Option<FilezFile>> {
        let collection = self.db.collection::<FilezFile>("files");
        let file = collection
            .find_one(
                doc! {
                    "readonly_path": path,
                },
                None,
            )
            .await?;
        Ok(file)
    }

    pub async fn get_static_file_groups_by_ids(
        &self,
        file_group_ids: &Vec<String>,
    ) -> anyhow::Result<Vec<FilezFileGroup>> {
        let collection = self.db.collection::<FilezFileGroup>("file_groups");
        let mut cursor = collection
            .find(
                doc! {
                    "$and":[
                        {
                            "_id": {
                                "$in": file_group_ids
                            }
                        },
                        {
                            "group_type": "Static"
                        }
                    ]
                },
                None,
            )
            .await?;

        let mut file_groups = vec![];

        while let Some(file_group) = cursor.try_next().await? {
            file_groups.push(file_group);
        }

        Ok(file_groups)
    }

    pub async fn check_file_group_existence(
        &self,
        static_file_group_ids: &Vec<String>,
    ) -> anyhow::Result<()> {
        let collection = self.db.collection::<FilezFileGroup>("file_groups");

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

    pub async fn get_permissions_by_resource_ids(
        &self,
        permission_ids: &Vec<String>,
    ) -> anyhow::Result<Vec<FilezPermission>> {
        let mut permissions = vec![];

        if !permission_ids.is_empty() {
            let collection = self.db.collection::<FilezPermission>("permissions");

            let mut cursor = collection
                .find(
                    doc! {
                        "_id": {
                            "$in": permission_ids
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
        let files_groups_collection = self.db.collection::<FilezFileGroup>("file_groups");
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
            .delete_one_with_session(
                doc! {
                    "_id": file.file_id
                },
                None,
                &mut session,
            )
            .await?;

        // update user
        let fsid = some_or_bail!(
            file.storage_id,
            "The to be deleted file has no associated storage id"
        );
        let user_key_used_storage = format!("limits.{}.used_storage", fsid);
        let user_key_used_files = format!("limits.{}.used_files", fsid);

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
                            "item_count": -1
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
                            "item_count": -1
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
        let user_key_used_storage = format!("limits.{}.used_storage", fsid);

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

        let files_groups_collection = self.db.collection::<FilezFileGroup>("file_groups");
        let files_collection = self.db.collection::<FilezFile>("files");
        let users_collection = self.db.collection::<FilezUser>("users");

        // update user

        if !ignore_user_limit {
            let fsid = some_or_bail!(
                file.storage_id.clone(),
                "The to be created file has no associated storage id"
            );
            let user_key_used_storage = format!("limits.{}.used_storage", fsid);
            let user_key_used_files = format!("limits.{}.used_files", fsid);
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
                            "item_count": 1
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
                                    "item_count": 1
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

    pub async fn send_friend_request(
        &self,
        requesting_user_id: &str,
        other_user_id: &str,
    ) -> anyhow::Result<UpdateResult> {
        let collection = &self.db.collection::<FilezUser>("users");

        Ok(collection
            .update_one(
                doc! {
                    "_id": other_user_id
                },
                doc! {
                    "$push": {
                        "pending_incoming_friend_requests": requesting_user_id
                    }
                },
                None,
            )
            .await?)
    }

    pub async fn remove_friend(
        &self,
        requesting_user_id: &str,
        other_user_id: &str,
    ) -> anyhow::Result<()> {
        let mut session = self.client.start_session(None).await?;

        session.start_transaction(None).await?;
        let collection = &self.db.collection::<FilezUser>("users");

        collection
            .update_one_with_session(
                doc! {
                    "_id": other_user_id
                },
                doc! {
                    "$pull": {
                        "friends": requesting_user_id
                    }
                },
                None,
                &mut session,
            )
            .await?;

        collection
            .update_one_with_session(
                doc! {
                    "_id": requesting_user_id
                },
                doc! {
                    "$pull": {
                        "friends": other_user_id
                    }
                },
                None,
                &mut session,
            )
            .await?;

        Ok(session.commit_transaction().await?)
    }

    pub async fn accept_friend_request(
        &self,
        requesting_user_id: &str,
        other_user_id: &str,
    ) -> anyhow::Result<()> {
        let mut session = self.client.start_session(None).await?;

        session.start_transaction(None).await?;
        let collection = &self.db.collection::<FilezUser>("users");

        collection
            .update_one_with_session(
                doc! {
                    "_id": requesting_user_id
                },
                doc! {
                    "$pull": {
                        "pending_incoming_friend_requests": other_user_id
                    },
                    "$push": {
                        "friends": other_user_id
                    }
                },
                None,
                &mut session,
            )
            .await?;

        collection
            .update_one_with_session(
                doc! {
                    "_id": other_user_id
                },
                doc! {
                    "$push": {
                        "friends": requesting_user_id
                    }
                },
                None,
                &mut session,
            )
            .await?;

        Ok(session.commit_transaction().await?)
    }

    pub async fn reject_friend_request(
        &self,
        requesting_user_id: &str,
        other_user_id: &str,
    ) -> anyhow::Result<UpdateResult> {
        let collection = &self.db.collection::<FilezUser>("users");

        Ok(collection
            .update_one(
                doc! {
                    "_id": requesting_user_id
                },
                doc! {
                    "$pull": {
                        "pending_incoming_friend_requests": other_user_id
                    }
                },
                None,
            )
            .await?)
    }

    pub async fn delete_file_group(&self, file_group: &FilezFileGroup) -> anyhow::Result<()> {
        let mut session = self.client.start_session(None).await?;

        session.start_transaction(None).await?;

        let collection = self.db.collection::<FilezFileGroup>("file_groups");

        collection
            .delete_one_with_session(
                doc! {
                    "_id": file_group.file_group_id.clone()
                },
                None,
                &mut session,
            )
            .await?;

        let files_collection = self.db.collection::<FilezFile>("files");

        // remove the group from all files
        files_collection
            .update_many_with_session(
                doc! {
                    "$or": [
                        {
                            "static_file_group_ids": file_group.file_group_id.clone()
                        },
                        {
                            "dynamic_file_group_ids": file_group.file_group_id.clone()
                        }
                    ]
                },
                doc! {
                    "$pull": {
                        "static_file_group_ids": file_group.file_group_id.clone(),
                        "dynamic_file_group_ids": file_group.file_group_id.clone()
                    }
                },
                None,
                &mut session,
            )
            .await?;

        Ok(session.commit_transaction().await?)
    }

    pub async fn delete_user_group(&self, user_group: &FilezUserGroup) -> anyhow::Result<()> {
        let mut session = self.client.start_session(None).await?;

        session.start_transaction(None).await?;

        let collection = self.db.collection::<FilezUserGroup>("user_groups");

        collection
            .delete_one_with_session(
                doc! {
                    "_id": user_group.user_group_id.clone()
                },
                None,
                &mut session,
            )
            .await?;

        let users_collection = self.db.collection::<FilezUser>("users");

        // remove the group from all files
        users_collection
            .update_many_with_session(
                doc! {
                    "$or": [
                        {
                            "user_group_ids": user_group.user_group_id.clone()
                        }
                    ]
                },
                doc! {
                    "$pull": {
                        "user_group_ids": user_group.user_group_id.clone(),
                    }
                },
                None,
                &mut session,
            )
            .await?;

        Ok(session.commit_transaction().await?)
    }
}
