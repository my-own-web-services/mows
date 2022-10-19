use crate::{
    some_or_bail,
    types::{AppDataType, FilezFile, FilezUser, SetAppDataRequest},
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
                        } IN users
                        "#,
                    )
                    .bind_var("id", sadr.id)
                    .bind_var("appData", sadr.app_data)
                    .bind_var("appName", sadr.app_name)
                    .build();
                let _res: Vec<FilezFile> = self.db.aql_query(query).await?;
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
                        } IN files
                        "#,
                    )
                    .bind_var("id", sadr.id)
                    .bind_var("appData", sadr.app_data)
                    .bind_var("appName", sadr.app_name)
                    .build();
                let _res: Vec<FilezFile> = self.db.aql_query(query).await?;
            }
            _ => bail!("Invalid appDataType"),
        }
        Ok(())
    }

    pub async fn get_files_by_group_id(&self, group_id: &str) -> anyhow::Result<Vec<FilezFile>> {
        let query = AqlQuery::builder()
            .query(
                r#"
                FOR file IN files
                FILTER file.groups[*] ANY == @group_id
                RETURN file
            "#,
            )
            .bind_var("group_id", group_id)
            .build();
        let files: Vec<FilezFile> = self.db.aql_query(query).await?;
        Ok(files)
    }

    pub async fn get_user_by_id(&self, id: &str) -> anyhow::Result<FilezUser> {
        let aql = AqlQuery::builder()
            .query(r#"RETURN DOCUMENT(CONCAT("users/",@uid))"#)
            .bind_var("uid", id)
            .build();

        let res: Vec<Value> = self.db.aql_query(aql).await?;
        let val = some_or_bail!(res.get(0), "User not found");
        let user: FilezUser = serde_json::from_value(val.clone())?;

        Ok(user)
    }

    pub async fn get_file_by_id(&self, id: &str) -> anyhow::Result<FilezFile> {
        let aql = AqlQuery::builder()
            .query(r#"RETURN DOCUMENT(CONCAT("files/",@id))"#)
            .bind_var("id", id)
            .build();

        let res: Vec<Value> = self.db.aql_query(aql).await?;
        let val = some_or_bail!(res.get(0), "File not found");
        let file: FilezFile = serde_json::from_value(val.clone())?;
        Ok(file)
    }

    pub async fn delete_file_by_id(&self, id: &str) -> anyhow::Result<()> {
        let aql = AqlQuery::builder()
            .query(r#"REMOVE DOCUMENT(CONCAT("files/",@id)) IN files"#)
            .bind_var("id", id)
            .build();

        let _res: Vec<String> = self.db.aql_query(aql).await?;

        Ok(())
    }

    pub async fn create_file(&self, file: FilezFile) -> anyhow::Result<()> {
        let mut vars = HashMap::new();
        vars.insert("file", serde_json::value::to_value(&file).unwrap());

        let _res: Vec<Value> = self
            .db
            .aql_bind_vars(
                "LET insertRes = (
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
                RETURN { insertRes, updateUserRes }",
                vars,
            )
            .await?;
        Ok(())
    }
}
