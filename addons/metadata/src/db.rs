use crate::{metadata_types::MetadataResult, types::FilezFile, utils::has_poster};
use mongodb::{bson::doc, options::ClientOptions, results::UpdateResult, Client, Database};

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

    pub async fn get_file_for_processing(&self) -> anyhow::Result<Option<FilezFile>> {
        let collection = self.db.collection::<FilezFile>("files");
        let current_time = chrono::offset::Utc::now().timestamp_millis();

        Ok(collection
            .find_one_and_update(
                doc! {
                    "$or":[
                        {
                            "appData.metadata.status": {
                                "$exists": false
                            }
                        },
                        {
                            "appData.metadata.rescan": {
                                "$eq": true
                            }
                        }
                    ]

                },
                doc! {
                    "$set": {
                        "appData.metadata.status": "processing",
                        "appData.metadata.startedAt": current_time
                    }
                },
                None,
            )
            .await?)
    }

    pub async fn update_file(
        &self,
        file_id: &str,
        metadata_result: MetadataResult,
    ) -> anyhow::Result<UpdateResult> {
        let collection = self.db.collection::<FilezFile>("files");
        let current_time = chrono::offset::Utc::now().timestamp_millis();

        Ok(collection
            .update_one(
                doc! { "_id": file_id },
                doc! {
                    "$set": {
                        "appData.metadata.result": bson::to_bson(&metadata_result)?,
                        "appData.metadata.status": "finished",
                        "appData.metadata.finishedAt": current_time,
                        "appData.image.rescan": has_poster(&metadata_result)
                    }
                },
                None,
            )
            .await?)
    }
}
