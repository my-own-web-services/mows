use crate::{
    internal_types::MergedFilezPermission,
    some_or_bail,
    types::{
        AppDataType, DeleteGroupRequest, DeletePermissionRequest, FilezFile, FilezFileGroup,
        FilezGroups, FilezPermission, FilezUser, FilezUserGroup, SetAppDataRequest,
        UpdatePermissionsRequest, UploadSpace,
    },
    utils::merge_permissions,
};
use anyhow::bail;
use futures::stream::TryStreamExt;
use mongodb::{
    bson::doc,
    results::{DeleteResult, InsertOneResult, UpdateResult},
};
use mongodb::{options::ClientOptions, Client, Database, IndexModel};
use std::vec;

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
        {
            let index = IndexModel::builder()
                .keys(doc! {"staticFileGroupIds": 1})
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

        Ok(())
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

    pub async fn update_permission_ids_on_resource(
        &self,
        upr: &UpdatePermissionsRequest,
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
        let mut cursor = collection.find(doc! {"ownerId": owner_id}, None).await?;

        let mut permissions = vec![];

        while let Some(perm) = cursor.try_next().await? {
            permissions.push(perm);
        }

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

    pub async fn get_file_groups_by_owner_id(
        &self,
        owner_id: &str,
    ) -> anyhow::Result<Vec<FilezFileGroup>> {
        let collection = self.db.collection::<FilezFileGroup>("fileGroups");

        let mut cursor = collection.find(doc! {"ownerId": owner_id}, None).await?;

        let mut file_groups = vec![];

        while let Some(file_group) = cursor.try_next().await? {
            file_groups.push(file_group);
        }

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
        dpr: &DeletePermissionRequest,
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
        dgr: &DeleteGroupRequest,
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

        let mut cursor = collection
            .find(doc! {"ownerId": owner_id,"name":group_name}, None)
            .await?;

        let mut file_groups = vec![];

        while let Some(file_group) = cursor.try_next().await? {
            file_groups.push(file_group);
        }

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

    pub async fn get_files_by_group_id(
        &self,
        group_id: &str,
        limit: Option<i64>,
        from_index: i64,
    ) -> anyhow::Result<Vec<FilezFile>> {
        let collection = self.db.collection::<FilezFile>("files");
        //TODO
        let mut cursor = collection
            .find(doc! {"staticFileGroupIds": group_id}, None)
            .await?;

        let mut files = vec![];

        while let Some(file) = cursor.try_next().await? {
            files.push(file);
        }

        Ok(files)
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

    pub async fn get_merged_permissions_from_file(
        &self,
        file: &FilezFile,
    ) -> anyhow::Result<MergedFilezPermission> {
        let mut permissions = vec![];

        // TODO check groups permissions

        // get the permission from the permission ids of the file
        if !file.permission_ids.is_empty() {
            let collection = self.db.collection::<FilezPermission>("permissions");

            let mut cursor = collection
                .find(doc! {"_id": {"$in": file.permission_ids.clone()}}, None)
                .await?;

            while let Some(permission) = cursor.try_next().await? {
                permissions.push(permission);
            }
        }

        merge_permissions(permissions)
    }

    pub async fn delete_file_by_id(&self, file: &FilezFile) -> anyhow::Result<()> {
        let mut session = self.client.start_session(None).await?;
        session.start_transaction(None).await?;

        let files_collection = self.db.collection::<FilezFile>("files");
        let files_groups_collection = self.db.collection::<FilezFileGroup>("filesGroups");
        let users_collection = self.db.collection::<FilezUser>("users");

        let file = some_or_bail!(
            files_collection
                .find_one(doc! {"_id": file.file_id.clone()}, None)
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

        let files_groups_collection = self.db.collection::<FilezFileGroup>("filesGroups");
        let files_collection = self.db.collection::<FilezFile>("files");
        let users_collection = self.db.collection::<FilezUser>("users");

        // update user
        let fsid = some_or_bail!(
            file.storage_id.clone(),
            "The to be deleted file has no associated storage id"
        );
        let user_key_used_storage = format!("limits.{}.usedStorage", fsid);
        let user_key_used_files = format!("limits.{}.usedFiles", fsid);

        if !ignore_user_limit {
            users_collection
                .update_one_with_session(
                    doc! {
                        "_id": &file.owner_id
                    },
                    doc! {
                        "$inc": {
                            user_key_used_storage: file.size as i64  ,
                            user_key_used_files: 1
                        }
                    },
                    None,
                    &mut session,
                )
                .await?;
        }
        for group in &file.static_file_group_ids {
            files_groups_collection
                .update_one_with_session(
                    doc! {
                        "_id": group
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

        for group in &file.dynamic_file_group_ids {
            files_groups_collection
                .update_one_with_session(
                    doc! {
                        "_id": group
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

        // create file
        files_collection
            .insert_one_with_session(file, None, &mut session)
            .await?;

        Ok(session.commit_transaction().await?)
    }
}
