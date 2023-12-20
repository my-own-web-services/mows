use crate::{
    config::SERVER_CONFIG,
    delete_permissions,
    internal_types::{AppDataType, FileResourceType, GetItemListRequestBody, SortOrder},
    methods::{
        set_app_data::SetAppDataRequest,
        update_permission_ids_on_resource::UpdatePermissionIdsOnResourceRequestBody,
    },
    permissions::{FilezPermission, PermissionResourceSelectType},
    some_or_bail,
};
use anyhow::bail;
use filez_common::server::{
    file::FilezFile,
    file_group::{FileGroupType, FilezFileGroup},
    user::{FilezUser, UsageLimits, UserRole},
    user_group::FilezUserGroup,
};
use futures::{stream::TryStreamExt, StreamExt};
use mongodb::{
    bson::doc,
    options::{FindOneOptions, FindOptions},
    results::{InsertOneResult, UpdateResult},
};
use mongodb::{options::ClientOptions, Client, Database, IndexModel};
use std::{collections::HashMap, vec};

pub struct DB {
    pub client: Client,
    pub db: Database,
    pub parallel_queries: u32,
}

impl DB {
    pub async fn new(client_options: ClientOptions) -> anyhow::Result<Self> {
        let client = Client::with_options(client_options)?;
        let db = client.database("filez");
        let config = &SERVER_CONFIG;
        Ok(Self {
            client,
            db,
            parallel_queries: config.db.parallel_queries,
        })
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
                .keys(doc! {
                 "static_file_group_ids": 1, "name": 1,"owner_id": 1,
                })
                .build();
            match files_collection.create_index(index, None).await {
                Ok(_) => {}
                Err(e) => println!("Error creating index on files collection: {:?}", e),
            };
        }

        {
            let index = IndexModel::builder()
                .keys(doc! {
                    "dynamic_file_group_ids": 1,"name": 1,"owner_id": 1,
                })
                .build();
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

    pub async fn get_permissions_by_id(
        &self,
        permission_ids: &Vec<String>,
    ) -> anyhow::Result<Vec<FilezPermission>> {
        let collection = self.db.collection::<FilezPermission>("permissions");

        let permissions = collection
            .find(
                doc! {
                    "_id": {
                        "$in": permission_ids
                    }
                },
                None,
            )
            .await?
            .try_collect::<Vec<_>>()
            .await?;

        Ok(permissions)
    }

    pub async fn get_users_by_id(&self, user_ids: &Vec<String>) -> anyhow::Result<Vec<FilezUser>> {
        let collection = self.db.collection::<FilezUser>("users");

        let users = collection
            .find(
                doc! {
                    "_id": {
                        "$in": user_ids
                    }
                },
                None,
            )
            .await?
            .try_collect::<Vec<_>>()
            .await?;

        Ok(users)
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
            .limit(gir.limit.map(|l| l.try_into().unwrap_or(0)))
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
                "content.type": match pt {
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

        Ok((items, total_count.try_into()?))
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

    pub async fn create_users(&self, users: &Vec<FilezUser>) -> anyhow::Result<()> {
        let mut session = self.client.start_session(None).await?;
        session.start_transaction(None).await?;

        let users_collection = self.db.collection::<FilezUser>("users");
        let file_groups_collection = self.db.collection::<FilezFileGroup>("file_groups");

        let mut file_groups: Vec<FilezFileGroup> = vec![];

        for user in users {
            file_groups.push(user.get_all_group());
        }

        users_collection
            .insert_many_with_session(users, None, &mut session)
            .await?;

        file_groups_collection
            .insert_many_with_session(file_groups, None, &mut session)
            .await?;

        Ok(session.commit_transaction().await?)
    }

    pub async fn get_users_all_file_group(&self, user_id: &str) -> anyhow::Result<FilezFileGroup> {
        let collection = self.db.collection::<FilezFileGroup>("file_groups");

        let res = collection
            .find_one(
                doc! {
                    "owner_id": user_id,
                    "all": true
                },
                None,
            )
            .await?;

        Ok(some_or_bail!(res, "Could not find all file group"))
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
            .limit(gir.limit.map(|l| l.try_into().unwrap_or(0)))
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

        Ok((items, total_count.try_into()?))
    }

    pub async fn get_user_groups_by_id(
        &self,
        user_group_ids: &Vec<String>,
    ) -> anyhow::Result<Vec<FilezUserGroup>> {
        let collection = self.db.collection::<FilezUserGroup>("user_groups");

        let user_groups = collection
            .find(
                doc! {
                    "_id": {
                        "$in": user_group_ids
                    }
                },
                None,
            )
            .await?
            .try_collect::<Vec<_>>()
            .await?;

        Ok(user_groups)
    }

    pub async fn delete_permissions(
        &self,
        permissions: &Vec<FilezPermission>,
    ) -> anyhow::Result<()> {
        let mut session = self.client.start_session(None).await?;
        session.start_transaction(None).await?;

        let mut permission_ids_by_resource_type: HashMap<String, Vec<String>> = HashMap::new();

        for permission in permissions {
            permission_ids_by_resource_type
                .entry(
                    match permission.content {
                        crate::permissions::PermissionResourceType::File(_) => "files",
                        crate::permissions::PermissionResourceType::FileGroup(_) => "file_groups",
                        crate::permissions::PermissionResourceType::UserGroup(_) => "user_groups",
                        crate::permissions::PermissionResourceType::User(_) => "users",
                    }
                    .to_string(),
                )
                .or_default()
                .push(permission.permission_id.clone());
        }

        dbg!(&permission_ids_by_resource_type);

        delete_permissions!(
            self,
            session,
            permission_ids_by_resource_type,
            FilezFile,
            "files"
        );

        delete_permissions!(
            self,
            session,
            permission_ids_by_resource_type,
            FilezFileGroup,
            "file_groups"
        );

        delete_permissions!(
            self,
            session,
            permission_ids_by_resource_type,
            FilezUserGroup,
            "user_groups"
        );

        delete_permissions!(
            self,
            session,
            permission_ids_by_resource_type,
            FilezUser,
            "users"
        );

        Ok(session.commit_transaction().await?)
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

    pub async fn update_files_names(
        &self,
        file_ids_by_names: &HashMap<String, Vec<String>>,
    ) -> anyhow::Result<()> {
        let collection = self.db.collection::<FilezFile>("files");

        let mut session = self.client.start_session(None).await?;
        session.start_transaction(None).await?;

        for (name, file_ids) in file_ids_by_names {
            collection
                .update_many_with_session(
                    doc! {
                        "_id": {
                            "$in": file_ids
                        }
                    },
                    doc! {
                        "$set": {
                            "name": name
                        }
                    },
                    None,
                    &mut session,
                )
                .await?;
        }

        Ok(session.commit_transaction().await?)
    }

    pub async fn update_files_mime_types(
        &self,
        file_ids_by_mime_type: &HashMap<String, Vec<String>>,
    ) -> anyhow::Result<()> {
        let collection = self.db.collection::<FilezFile>("files");

        let mut session = self.client.start_session(None).await?;
        session.start_transaction(None).await?;

        for (mime_type, file_ids) in file_ids_by_mime_type {
            collection
                .update_many_with_session(
                    doc! {
                        "_id": {
                            "$in": file_ids
                        }
                    },
                    doc! {
                        "$set": {
                            "mime_type": mime_type
                        }
                    },
                    None,
                    &mut session,
                )
                .await?;
        }

        Ok(session.commit_transaction().await?)
    }

    pub async fn update_files_pending_owner(
        &self,
        file_ids_by_new_owner: &HashMap<String, Vec<String>>,
    ) -> anyhow::Result<()> {
        let collection = self.db.collection::<FilezFile>("files");

        let mut session = self.client.start_session(None).await?;
        session.start_transaction(None).await?;

        for (new_owner_id, file_ids) in file_ids_by_new_owner {
            collection
                .update_many_with_session(
                    doc! {
                        "_id": {
                            "$in": file_ids
                        }
                    },
                    doc! {
                        "$set": {
                            "pending_new_owner_id": new_owner_id
                        }
                    },
                    None,
                    &mut session,
                )
                .await?;
        }

        Ok(session.commit_transaction().await?)
    }

    pub async fn update_files_and_file_groups(
        &self,
        file_ids_by_single_group_to_be_added: &HashMap<String, Vec<String>>,
        file_ids_by_single_group_to_be_removed: &HashMap<String, Vec<String>>,
        group_type: FileGroupType,
    ) -> anyhow::Result<()> {
        let files_collection = self.db.collection::<FilezFile>("files");
        let file_groups_collection = self.db.collection::<FilezFileGroup>("file_groups");

        let mut session = self.client.start_session(None).await?;
        session.start_transaction(None).await?;

        let field = match group_type {
            FileGroupType::Static => "static_file_group_ids",
            FileGroupType::Dynamic => "dynamic_file_group_ids",
        };

        for (file_group_id, file_ids) in file_ids_by_single_group_to_be_added {
            files_collection
                .update_many_with_session(
                    doc! {
                        "_id": {
                            "$in": file_ids
                        }
                    },
                    doc! {
                        "$push": {
                            field: file_group_id
                        }
                    },
                    None,
                    &mut session,
                )
                .await?;
        }

        for (file_group_id, file_ids) in file_ids_by_single_group_to_be_removed {
            files_collection
                .update_many_with_session(
                    doc! {
                        "_id": {
                            "$in": file_ids
                        }
                    },
                    doc! {
                        "$pull": {
                            field: file_group_id
                        }
                    },
                    None,
                    &mut session,
                )
                .await?;
        }

        for (file_group_id, file_ids) in file_ids_by_single_group_to_be_added {
            let ic: u32 = file_ids.len().try_into()?;

            file_groups_collection
                .update_many_with_session(
                    doc! {
                        "_id": file_group_id
                    },
                    doc! {
                        "$inc": {
                            "item_count": ic
                        }
                    },
                    None,
                    &mut session,
                )
                .await?;
        }

        for (file_group_id, file_ids) in file_ids_by_single_group_to_be_removed {
            let ic: i32 = file_ids.len().try_into()?;
            file_groups_collection
                .update_many_with_session(
                    doc! {
                        "_id": file_group_id
                    },
                    doc! {
                        "$inc": {
                            "item_count": -ic
                        }
                    },
                    None,
                    &mut session,
                )
                .await?;
        }

        Ok(session.commit_transaction().await?)
    }

    pub async fn update_file_keywords(
        &self,
        file_ids_by_single_keyword_to_be_added: &HashMap<String, Vec<String>>,
        file_ids_by_single_keyword_to_be_removed: &HashMap<String, Vec<String>>,
    ) -> anyhow::Result<()> {
        let collection = self.db.collection::<FilezFile>("files");

        let mut session = self.client.start_session(None).await?;
        session.start_transaction(None).await?;

        for (keyword, file_ids) in file_ids_by_single_keyword_to_be_added {
            collection
                .update_many_with_session(
                    doc! {
                        "_id": {
                            "$in": file_ids
                        }
                    },
                    doc! {
                        "$push": {
                            "keywords": keyword
                        }
                    },
                    None,
                    &mut session,
                )
                .await?;
        }

        for (keyword, file_ids) in file_ids_by_single_keyword_to_be_removed {
            collection
                .update_many_with_session(
                    doc! {
                        "_id": {
                            "$in": file_ids
                        }
                    },
                    doc! {
                        "$pull": {
                            "keywords": keyword
                        }
                    },
                    None,
                    &mut session,
                )
                .await?;
        }

        Ok(session.commit_transaction().await?)
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
        let old_file_count_key = format!("limits.{}.used_files", old_storage_id);

        let new_used_storage_key = format!("limits.{}.used_storage", new_storage_id);
        let new_file_count_key = format!("limits.{}.used_files", new_storage_id);

        let file_size: i64 = file.size.try_into()?;

        users_collection
            .update_one_with_session(
                doc! {
                    "_id": &user.user_id
                },
                doc! {
                    "$inc": {
                        old_used_storage_key: -file_size,
                        new_used_storage_key: file_size,
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
            .limit(gir.limit.map(|l| l.try_into().unwrap_or(0)))
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

        Ok((user_groups, total_count.try_into()?))
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
            .limit(gir.limit.map(|l| l.try_into().unwrap_or(0)))
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

        Ok((users, total_count.try_into()?))
    }

    pub async fn get_files_by_group_id(
        &self,
        group_id: &str,
        gir: &GetItemListRequestBody,
    ) -> anyhow::Result<(Vec<FilezFile>, u32)> {
        let collection = self.db.collection::<FilezFile>("files");
        let group_collection = self.db.collection::<FilezFileGroup>("file_groups");

        let sort_field = gir.sort_field.clone().unwrap_or("_id".to_string());
        let find_options = FindOptions::builder()
            .sort(doc! {
                sort_field: match gir.sort_order {
                    Some(SortOrder::Ascending) => 1,
                    Some(SortOrder::Descending) => -1,
                    None => 1
            }
            })
            .limit(gir.limit.map(|l| l.try_into().unwrap_or(0)))
            .skip(gir.from_index)
            .build();

        let search_filter = match &gir.filter {
            Some(f) => {
                if !f.is_empty() {
                    doc! {
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
                    }
                } else {
                    doc! {}
                }
            }
            None => doc! {},
        };

        //TODO dont use count documents at other places

        let group_type_filter = match &gir.sub_resource_type {
            Some(v) => match v.as_str() {
                "static_file_group_ids" => doc! {"static_file_group_ids": &group_id},
                "dynamic_file_group_ids" => doc! {"dynamic_file_group_ids": &group_id},
                _ => bail!("invalid sub resource type"),
            },

            None => doc! {
                "$or":[
                    {
                        "static_file_group_ids": &group_id
                    },
                    {
                        "dynamic_file_group_ids": &group_id
                    }
                ]
            },
        };

        let db_filter = doc! {
            "$and": [
                group_type_filter,
                search_filter,
            ]
        };

        let items = collection
            .find(db_filter.clone(), find_options)
            .await?
            .try_collect::<Vec<_>>()
            .await?;

        // this of course does not work when filtering items out
        let item_count = match gir.filter {
            Some(_) => collection
                .count_documents(db_filter.clone(), None)
                .await?
                .try_into()?,
            None => {
                // for some reason collection.count is very slow; it is much faster in compass
                // this is why we just skip it if there is no filter
                some_or_bail!(
                    group_collection
                        .find_one(
                            doc! {
                                "_id": group_id
                            },
                            None,
                        )
                        .await?,
                    "Could not find group"
                )
                .item_count
            }
        };

        //let total_count =
        // for some reason collection.count is very slow; it is much faster in compass
        Ok((items, item_count as u32))
    }

    pub async fn get_user_by_id(&self, user_id: &str) -> anyhow::Result<Option<FilezUser>> {
        let collection = self.db.collection::<FilezUser>("users");
        let user = collection
            .find_one(
                doc! {
                    "_id": user_id
                },
                None,
            )
            .await?;
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
            .projection(doc! {
                "_id": 1
            })
            .build();

        let user = collection
            .find_one(
                doc! {
                    "ir_user_id": ir_user_id
                },
                find_options,
            )
            .await?;

        Ok(user.map(|u| u._id))
    }

    pub async fn get_user_by_ir_id(&self, ir_user_id: &str) -> anyhow::Result<Option<FilezUser>> {
        let collection = self.db.collection::<FilezUser>("users");
        let user = collection
            .find_one(
                doc! {
                    "ir_user_id": ir_user_id
                },
                None,
            )
            .await?;
        Ok(user)
    }

    pub async fn get_user_by_email(&self, email: &str) -> anyhow::Result<Option<FilezUser>> {
        let collection = self.db.collection::<FilezUser>("users");
        let user = collection
            .find_one(
                doc! {
                    "email": email
                },
                None,
            )
            .await?;
        Ok(user)
    }

    pub async fn get_file_by_id(&self, file_id: &str) -> anyhow::Result<Option<FilezFile>> {
        let collection = self.db.collection::<FilezFile>("files");
        let file = collection
            .find_one(
                doc! {
                    "_id": file_id
                },
                None,
            )
            .await?;
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

    pub async fn get_file_groups_by_ids(
        &self,
        file_group_ids: &Vec<String>,
    ) -> anyhow::Result<Vec<FilezFileGroup>> {
        let collection = self.db.collection::<FilezFileGroup>("file_groups");
        let mut cursor = collection
            .find(
                doc! {
                    "_id": {
                        "$in": file_group_ids
                    }
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

    pub async fn check_users_exist(&self, user_ids: &Vec<String>) -> anyhow::Result<()> {
        let collection = self.db.collection::<FilezUser>("users");

        let cursor = collection
            .find(
                doc! {
                    "_id": {
                        "$in": user_ids.clone()
                    }
                },
                None,
            )
            .await?;

        if cursor.count().await != user_ids.len() {
            bail!("Some user_ids do not exist");
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

    pub async fn delete_files_by_ids(
        &self,
        files_to_delete: &Vec<FilezFile>,
    ) -> anyhow::Result<()> {
        let mut session = self.client.start_session(None).await?;
        session.start_transaction(None).await?;

        let files_collection = self.db.collection::<FilezFile>("files");
        let files_groups_collection = self.db.collection::<FilezFileGroup>("file_groups");
        let users_collection = self.db.collection::<FilezUser>("users");

        // delete file
        files_collection
            .delete_many_with_session(
                doc! {
                    "_id": {
                        "$in": files_to_delete.iter().map(|f| f.file_id.clone()).collect::<Vec<_>>()
                    }
                },
                None,
                &mut session,
            )
            .await?;

        // sort the files by owner id
        let mut files_by_owner_id: HashMap<String, Vec<FilezFile>> = HashMap::new();

        for file in files_to_delete {
            let owner_id = file.owner_id.clone();

            let files = files_by_owner_id.entry(owner_id).or_default();
            files.push(file.clone());
        }

        for (owner_id, files_of_owner) in files_by_owner_id {
            let mut files_by_storage_id: HashMap<String, Vec<FilezFile>> = HashMap::new();
            for file in files_of_owner {
                let storage_id = some_or_bail!(
                    file.storage_id.clone(),
                    "The to be deleted file has no associated storage id"
                );

                let f = files_by_storage_id.entry(storage_id).or_default();
                f.push(file);
            }

            for (storage_id, files_of_storage) in files_by_storage_id {
                // update user

                let user_key_used_storage = format!("limits.{}.used_storage", storage_id);
                let user_key_used_files = format!("limits.{}.used_files", storage_id);

                let ammount: i64 = files_of_storage.len().try_into()?;
                let size: i64 = files_of_storage
                    .iter()
                    .map(|f| f.size)
                    .sum::<u64>()
                    .try_into()?;
                users_collection
                    .update_one_with_session(
                        doc! {
                            "_id": owner_id.clone()
                        },
                        doc! {
                            "$inc": {
                                user_key_used_storage: -size,
                                user_key_used_files: -ammount
                            }
                        },
                        None,
                        &mut session,
                    )
                    .await?;
            }
        }

        let mut file_count_by_file_group_id: HashMap<String, u32> = HashMap::new();

        for file in files_to_delete {
            let all_group_ids = &file
                .static_file_group_ids
                .iter()
                .chain(&file.dynamic_file_group_ids)
                .collect::<Vec<_>>();

            for group_id in all_group_ids {
                let count = file_count_by_file_group_id
                    .entry(group_id.to_string())
                    .or_insert(0);
                *count += 1;
            }
        }

        // update file groups
        // decrease item count for all groups that are assigned to the file
        for (group_id, file_count) in file_count_by_file_group_id {
            let fc: i64 = file_count.try_into()?;
            files_groups_collection
                .update_one_with_session(
                    doc! {
                        "_id": group_id
                    },
                    doc! {
                        "$inc": {
                            "item_count": -fc
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

        let new_size: i64 = new_size.try_into()?;
        let old_size: i64 = old_file.size.try_into()?;
        let inc_value = some_or_bail!(new_size.checked_sub(old_size), "file size did overflow");

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
                        "size": new_size,
                        "modified": new_modified
                    }
                },
                None,
                &mut session,
            )
            .await?;

        Ok(session.commit_transaction().await?)
    }

    pub async fn get_total_ammount_of_files(&self) -> anyhow::Result<u64> {
        let collection = self.db.collection::<FilezFile>("files");

        let total_count = collection.count_documents(doc! {}, None).await?;

        Ok(total_count)
    }

    pub async fn create_many_mock_files(
        &self,
        files: Vec<FilezFile>,
        static_file_group_ids: Vec<String>,
        owner_id: &str,
        storage_id: &str,
    ) -> anyhow::Result<()> {
        let mut session = self.client.start_session(None).await?;

        session.start_transaction(None).await?;

        let files_groups_collection = self.db.collection::<FilezFileGroup>("file_groups");
        let files_collection = self.db.collection::<FilezFile>("files");
        let users_collection = self.db.collection::<FilezUser>("users");

        // update user

        for group_id in &static_file_group_ids {
            let file_len: i64 = files.len().try_into()?;
            files_groups_collection
                .update_one_with_session(
                    doc! {
                        "_id": group_id
                    },
                    doc! {
                        "$inc": {
                            "item_count":file_len
                        }
                    },
                    None,
                    &mut session,
                )
                .await?;
        }

        let user_key_used_storage = format!("limits.{}.used_storage", storage_id);
        let user_key_used_files = format!("limits.{}.used_files", storage_id);

        let size: i64 = files.iter().map(|f| f.size).sum::<u64>().try_into()?;
        let count: i64 = files.len().try_into()?;

        // create files
        files_collection
            .insert_many_with_session(files, None, &mut session)
            .await?;

        users_collection
            .update_one_with_session(
                doc! {
                    "_id": owner_id
                },
                doc! {
                    "$inc": {
                        user_key_used_storage: size,
                        user_key_used_files: count
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
            let file_size: i64 = file.size.try_into()?;

            users_collection
                .update_one_with_session(
                    doc! {
                        "_id": &file.owner_id
                    },
                    doc! {
                        "$inc": {
                            user_key_used_storage: file_size,
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

    pub async fn delete_file_groups(&self, file_group: &[FilezFileGroup]) -> anyhow::Result<()> {
        let collection = self.db.collection::<FilezFileGroup>("file_groups");
        let files_collection = self.db.collection::<FilezFile>("files");

        let mut session = self.client.start_session(None).await?;
        session.start_transaction(None).await?;

        let file_groups_ids = file_group
            .iter()
            .map(|f| f.file_group_id.clone())
            .collect::<Vec<_>>();

        collection
            .delete_many_with_session(
                doc! {
                    "_id": {
                        "$in": file_groups_ids.clone()
                    }
                },
                None,
                &mut session,
            )
            .await?;

        // remove the group from all files
        files_collection
            .update_many_with_session(
                doc! {
                    "$or": [
                        {
                            "static_file_group_ids": file_groups_ids.clone()
                        },
                        {
                            "dynamic_file_group_ids": file_groups_ids.clone()
                        }
                    ]
                },
                doc! {
                    "$pullAll": {
                        "static_file_group_ids": file_groups_ids.clone(),
                        "dynamic_file_group_ids": file_groups_ids.clone()
                    }
                },
                None,
                &mut session,
            )
            .await?;

        Ok(session.commit_transaction().await?)
    }

    pub async fn delete_user_groups(&self, user_groups: &[FilezUserGroup]) -> anyhow::Result<()> {
        let mut session = self.client.start_session(None).await?;
        session.start_transaction(None).await?;

        let collection = self.db.collection::<FilezUserGroup>("user_groups");

        let user_group_ids = user_groups
            .iter()
            .map(|f| f.user_group_id.clone())
            .collect::<Vec<_>>();

        collection
            .delete_many_with_session(
                doc! {
                    "_id": {
                        "$in": user_group_ids.clone()
                    }
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
                            "user_group_ids": user_group_ids.clone()
                        }
                    ]
                },
                doc! {
                    "$pullAll": {
                        "user_group_ids": user_group_ids,
                    }
                },
                None,
                &mut session,
            )
            .await?;

        Ok(session.commit_transaction().await?)
    }
}
