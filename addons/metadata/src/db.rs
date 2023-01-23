use crate::{metadata_types::Metadata, types::FilezFile};
use futures::TryStreamExt;
use mongodb::{bson::doc, options::ClientOptions, results::UpdateResult, Client, Database};
use serde_json::Value;
use std::collections::HashMap;

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

    pub async fn dev_clear_metadata_app_data(&self) -> anyhow::Result<()> {
        let collection = self.db.collection::<FilezFile>("files");
        collection
            .update_many(
                doc! {
                    "appData.metadata": {
                        "$exists": true
                    }
                },
                doc! {
                    "$unset": {
                        "appData.metadata": ""
                    }
                },
                None,
            )
            .await?;
        Ok(())
    }

    pub async fn get_unscanned(&self) -> anyhow::Result<Vec<FilezFile>> {
        let collection = self.db.collection::<FilezFile>("files");
        let mut cursor = collection
            .find(doc! {"appData.metadata":{"$exists":false}}, None)
            .await?;

        let mut files = Vec::new();
        while let Some(file) = cursor.try_next().await? {
            files.push(file);
        }

        Ok(files)
    }

    pub async fn update_file(&self, file_id: &str, data: Metadata) -> anyhow::Result<UpdateResult> {
        let collection = self.db.collection::<FilezFile>("files");
        Ok(collection
            .update_one(
                doc! {"_id":file_id},
                doc! {"$set":{"appData.metadata":bson::to_bson(&data)?}},
                None,
            )
            .await?)
    }
}
