use crate::{
    some_or_bail,
    types::{
        AppDataType, DeleteGroupRequest, DeletePermissionRequest, FilezFile, FilezFileGroup,
        FilezGroups, FilezPermission, FilezUser, FilezUserGroup, SetAppDataRequest,
        UpdatePermissionsRequest,
    },
};
use anyhow::bail;
use arangors::{uclient::reqwest::ReqwestClient, AqlQuery, Connection, Database};
use serde_json::Value;
use std::collections::HashMap;

pub struct DB {
    pub con: Connection,
    pub db: Database<ReqwestClient>,
}

impl DB {
    pub async fn new(con: Connection) -> anyhow::Result<Self> {
        let db = con.db("filez").await?;
        Ok(Self { con, db })
    }

    //pub async fn delete_permission(&self)-> anyhow::Result<()>{}
    pub async fn update_permission_ids_on_resource(
        &self,
        upr: &UpdatePermissionsRequest,
        user_id: &str,
    ) -> anyhow::Result<()> {
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
        match upr.resource_type {
            crate::types::FileResourceType::FileGroup => {
                let group = self.get_file_group_by_id(&upr.resource_id).await?;
                if group.owner_id != user_id {
                    bail!("You do not own this FileGroup");
                }

                // update permissions on the file group
                let aql = AqlQuery::builder()
                    .query(
                        r#"
                    LET updateFileGroupRes=(
                        UPDATE @file_group_id WITH { 
                            permissionIds: @permission_ids, 
                                } IN files
                        RETURN true
                    )                    
                    RETURN { updateFileGroupRes }"#,
                    )
                    .bind_var("file_group_id", group.file_group_id)
                    .bind_var("permission_ids", upr.permission_ids.clone())
                    .build();

                self.db.aql_query::<Vec<Value>>(aql).await?;

                Ok(())
            }
            crate::types::FileResourceType::File => {
                let file = self.get_file_by_id(&upr.resource_id).await?;
                if file.owner_id != user_id {
                    bail!("You do not own this file");
                }
                // update permissions on the file
                let aql = AqlQuery::builder()
                    .query(
                        r#"
                        LET updateFileRes=(
                            UPDATE @file_id WITH { 
                                permissionIds: @permission_ids, 
                                    } IN files
                            RETURN true
                        )
                        RETURN { updateFileRes }"#,
                    )
                    .bind_var("file_id", file.file_id.clone())
                    .bind_var("permission_ids", upr.permission_ids.clone())
                    .build();

                self.db.aql_query::<Vec<Value>>(aql).await?;

                Ok(())
            }
        }
    }

    pub async fn get_permissions_by_owner_id(
        &self,
        owner_id: &str,
    ) -> anyhow::Result<Vec<FilezPermission>> {
        let aql = AqlQuery::builder()
            .query(
                r#"
            LET getRes=(
                FOR p IN permissions
                FILTER p.ownerId==@owner_id
                RETURN p
            )           
            RETURN { getRes }"#,
            )
            .bind_var("owner_id", owner_id)
            .build();

        let permissions: Vec<FilezPermission> = self.db.aql_query(aql).await?;
        Ok(permissions)
    }

    pub async fn get_file_group_by_id(
        &self,
        file_group_id: &str,
    ) -> anyhow::Result<FilezFileGroup> {
        let aql = AqlQuery::builder()
            .query(r#"RETURN DOCUMENT(CONCAT("fileGroups/",@file_group_id))"#)
            .bind_var("file_group_id", file_group_id)
            .build();

        let res: Vec<Value> = self.db.aql_query(aql).await?;
        let val = some_or_bail!(res.get(0), "FileGroup not found");
        let file: FilezFileGroup = serde_json::from_value(val.clone())?;

        Ok(file)
    }

    pub async fn get_user_group_by_id(
        &self,
        user_group_id: &str,
    ) -> anyhow::Result<FilezUserGroup> {
        let aql = AqlQuery::builder()
            .query(r#"RETURN DOCUMENT(CONCAT("userGroups/",@file_group_id))"#)
            .bind_var("file_group_id", user_group_id)
            .build();

        let res: Vec<Value> = self.db.aql_query(aql).await?;
        let val = some_or_bail!(res.get(0), "UserGroup not found");
        let file: FilezUserGroup = serde_json::from_value(val.clone())?;

        Ok(file)
    }

    pub async fn delete_permission(
        &self,
        dpr: &DeletePermissionRequest,
        owner_id: &str,
    ) -> anyhow::Result<()> {
        let aql = AqlQuery::builder()
            .query(
                r#"
            LET removeRes=(
                FOR p IN permissions
                FILTER p.permissionId==@permission_id && p.ownerId==@owner_id
                REMOVE p IN permissions
            )           
            RETURN { removeRes }"#,
            )
            .bind_var("permission_id", dpr.permission_id.clone())
            .bind_var("owner_id", owner_id)
            .build();

        self.db.aql_query::<Value>(aql).await?;

        Ok(())
    }
    pub async fn delete_group(
        &self,
        dgr: &DeleteGroupRequest,
        owner_id: &str,
    ) -> anyhow::Result<()> {
        let collection_name = match dgr.group_type {
            crate::types::GroupType::User => "userGroups",
            crate::types::GroupType::File => "fileGroups",
        };

        let q = format!(
            r#"
            LET removeRes=(
                FOR g IN {}
                FILTER g.groupId==@group_id && p.ownerId==@owner_id
                REMOVE p IN {}
            )           
            RETURN {{ removeRes }}"#,
            collection_name, collection_name
        );

        let aql = AqlQuery::builder()
            .query(&q)
            .bind_var("group_id", dgr.group_id.clone())
            .bind_var("owner_id", owner_id)
            .build();

        self.db.aql_query::<Value>(aql).await?;

        Ok(())
    }

    pub async fn create_permission(&self, permission: &FilezPermission) -> anyhow::Result<()> {
        let mut vars = HashMap::new();
        vars.insert(
            "permission",
            serde_json::value::to_value(&permission).unwrap(),
        );
        self.db
            .aql_bind_vars::<Vec<Value>>(
                r#"
                LET insertRes = (
                    INSERT @permission IN permissions
                )
                RETURN {{ insertRes }}"#,
                vars,
            )
            .await?;
        Ok(())
    }

    pub async fn create_group(&self, group: &FilezGroups) -> anyhow::Result<()> {
        let mut vars = HashMap::new();
        vars.insert("group", serde_json::value::to_value(&group).unwrap());
        self.db
            .aql_bind_vars::<Vec<Value>>(
                &format!(
                    r#"
                LET insertRes = (
                    INSERT @group IN {}
                )
                RETURN {{ insertRes }}"#,
                    match group {
                        FilezGroups::FilezUserGroup(_) => "userGroups",
                        FilezGroups::FilezFileGroup(_) => "fileGroups",
                    }
                ),
                vars,
            )
            .await?;
        Ok(())
    }

    pub async fn set_app_data(&self, sadr: SetAppDataRequest) -> anyhow::Result<()> {
        match sadr.app_data_type {
            AppDataType::User => {
                let query = AqlQuery::builder()
                    .query(
                        r#"
                        FOR u IN users
                        FILTER u._key == @id
                        UPDATE u WITH {
                            appData: { 
                                [@appName]: @appData
                            }
                        } IN users"#,
                    )
                    .bind_var("id", sadr.id)
                    .bind_var("appData", sadr.app_data)
                    .bind_var("appName", sadr.app_name)
                    .build();
                self.db.aql_query::<Vec<FilezFile>>(query).await?;
            }
            AppDataType::File => {
                let query = AqlQuery::builder()
                    .query(
                        r#"
                        FOR f IN files
                        FILTER f._key == @id
                        UPDATE f WITH {
                            appData: { 
                                [@appName]: @appData
                            }
                        } IN files"#,
                    )
                    .bind_var("id", sadr.id)
                    .bind_var("appData", sadr.app_data)
                    .bind_var("appName", sadr.app_name)
                    .build();
                self.db.aql_query::<Vec<FilezFile>>(query).await?;
            }
        }
        Ok(())
    }

    pub async fn get_files_by_group_id(&self, group_id: &str) -> anyhow::Result<Vec<FilezFile>> {
        let query = AqlQuery::builder()
            .query(
                r#"
                FOR file IN files
                FILTER file.groups[*] ANY == @group_id
                RETURN file"#,
            )
            .bind_var("group_id", group_id)
            .build();
        let files: Vec<FilezFile> = self.db.aql_query(query).await?;
        Ok(files)
    }

    pub async fn get_user_by_id(&self, user_id: &str) -> anyhow::Result<FilezUser> {
        let aql = AqlQuery::builder()
            .query(r#"RETURN DOCUMENT(CONCAT("users/",@user_id))"#)
            .bind_var("user_id", user_id)
            .build();

        let res: Vec<Value> = self.db.aql_query(aql).await?;
        let val = some_or_bail!(res.get(0), "User not found");
        let user: FilezUser = serde_json::from_value(val.clone())?;

        Ok(user)
    }

    pub async fn get_file_by_id(&self, file_id: &str) -> anyhow::Result<FilezFile> {
        let aql = AqlQuery::builder()
            .query(r#"RETURN DOCUMENT(CONCAT("files/",@file_id))"#)
            .bind_var("file_id", file_id)
            .build();

        let res: Vec<Value> = self.db.aql_query(aql).await?;
        let val = some_or_bail!(res.get(0), "File not found");
        let file: FilezFile = serde_json::from_value(val.clone())?;

        Ok(file)
    }

    pub async fn delete_file_by_id(&self, file: &FilezFile) -> anyhow::Result<()> {
        let aql = AqlQuery::builder()
            .query(r#"
            LET removeFileRes=(
                REMOVE DOCUMENT(CONCAT("files/",@id)) IN files
            )

            LET oldUser = (
                FOR u IN users
                FILTER u._key == @owner
                LIMIT 1
                RETURN u
            )
            
            LET updateUserRes = (
                UPDATE @owner WITH {
                    limits: {
                        [@storageName]: {
                            usedStorage: VALUE(oldUser[0].limits,[@storageName]).usedStorage - @size,
                            usedFiles: VALUE(oldUser[0].limits,[@storageName]).usedFiles - 1
                        }
                    }
                } IN users
                RETURN true
            )
            RETURN { removeFileRes, updateUserRes }"#)
            .bind_var("id", file.file_id.clone())
            .bind_var("owner", file.owner_id.clone())
            .bind_var("storageName", file.storage_name.clone())
            .bind_var("size", file.size)
            .build();

        self.db.aql_query::<Value>(aql).await?;

        Ok(())
    }

    pub async fn update_file_with_content_change(
        &self,
        file: &FilezFile,
        sha256: &str,
        size: u64,
        modified: i64,
    ) -> anyhow::Result<()> {
        let aql = AqlQuery::builder()
            .query(
                r#"
            LET updateFileRes=(
                UPDATE @id WITH { 
                    size: @newSize, 
                    modified: @modified, 
                    sha256: @sha256
                } IN files
                RETURN true
            )
            
            LET oldUser = (
                FOR u IN users
                FILTER u._key == @owner
                LIMIT 1
                RETURN u
            )

            LET updateUserRes = (
                UPDATE @owner WITH {
                    limits: {
                        [@storageName]: {
                            usedStorage: VALUE(oldUser[0].limits,[@storageName]).usedStorage + @newSize - @oldSize,
                        }
                    }
                } IN users
                RETURN true
            )

            RETURN { updateFileRes, updateUserRes }"#,
            )
            .bind_var("id", file.file_id.clone())
            .bind_var("sha256", sha256)
            .bind_var("newSize", size)
            .bind_var("oldSize", file.size)
            .bind_var("modified", modified)
            .bind_var("owner", file.owner_id.clone())
            .bind_var("storageName", file.storage_name.clone())
            .build();

        self.db.aql_query::<Vec<Value>>(aql).await?;

        Ok(())
    }

    pub async fn create_file(&self, file: FilezFile) -> anyhow::Result<()> {
        let mut vars = HashMap::new();
        vars.insert("file", serde_json::value::to_value(&file).unwrap());

        let _res: Vec<Value> = self
            .db
            .aql_bind_vars(
                r#"
                LET insertRes = (
                    INSERT @file INTO files 
                    RETURN true
                )

                LET oldUser = (
                    FOR u IN users
                    FILTER u._key == @file.owner
                    LIMIT 1
                    RETURN u
                )

                LET updateUserRes = (
                    UPDATE @file.owner WITH {
                        limits: {
                            [@file.storageName]: {
                                usedStorage: VALUE(oldUser[0].limits,[@file.storageName]).usedStorage + @file.size,
                                usedFiles: VALUE(oldUser[0].limits,[@file.storageName]).usedFiles + 1
                            }
                        }
                    } IN users
                    RETURN true
                )
                RETURN { insertRes, updateUserRes }"#,
                vars,
            )
            .await?;
        Ok(())
    }
}
