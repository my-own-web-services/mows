use crate::{some_or_bail, types::FilezFile};
use arangors::{uclient::reqwest::ReqwestClient, AqlQuery, Connection, Database};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

pub struct DB {
    pub con: Connection,
    pub db: Database<ReqwestClient>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq)]
pub struct FilezUser {
    #[serde(rename = "_key")]
    pub id: String,
    pub limits: HashMap<String, UserLimits>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UserLimits {
    pub max_storage: u64,
    pub used_storage: u64,
    pub max_files: u64,
    pub used_files: u64,
    pub max_bandwidth: u64,
    pub used_bandwidth: u64,
}

impl DB {
    pub async fn new(con: Connection) -> anyhow::Result<Self> {
        let db = con.db("filez").await?;
        Ok(Self { con, db })
    }

    pub async fn get_user(&self) -> anyhow::Result<FilezUser> {
        let uid = "test";

        let aql = AqlQuery::builder()
            .query(r#"RETURN DOCUMENT(CONCAT("users/",@uid))"#)
            .bind_var("uid", uid)
            .build();

        let res: Vec<Value> = self.db.aql_query(aql).await?;
        let val = some_or_bail!(res.get(0), "User not found");
        let user: FilezUser = serde_json::from_value(val.clone())?;
        Ok(user)
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
