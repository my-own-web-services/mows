use crate::{image_processor_types::ProcessedImage, types::FilezFile};
use mongodb::{bson::doc, options::ClientOptions, Client, Database};

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

    pub async fn dev_clear_image_processor_app_data(&self) -> anyhow::Result<()> {
        let collection = self.db.collection::<FilezFile>("files");
        collection
            .update_many(
                doc! {
                    "appData.imageProcessor": {
                        "$exists": true
                    }
                },
                doc! {
                    "$unset": {
                        "appData.imageProcessor": ""
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

        let file = collection
            .find_one_and_update(
                doc! {
                    "$and":[
                        {
                           "$or":[
                            {
                                "mimeType":{
                                    "$regex": "^(image|audio)/"
                                }
                            }
                           ]
                        },
                        {
                            "appData.imageProcessor.status": {
                                "$exists": false
                            }
                        }
                    ]
                },
                doc! {
                    "$set": {
                        "appData.imageProcessor.status": "processing",
                        "appData.imageProcessor.startedAt": current_time
                    }
                },
                None,
            )
            .await?;

        Ok(file)
    }

    pub async fn update_image_processing_status(
        &self,
        file_id: &str,
        error: &Option<String>,
        result: &Option<ProcessedImage>,
    ) -> anyhow::Result<()> {
        let collection = self.db.collection::<FilezFile>("files");

        let current_time = chrono::offset::Utc::now().timestamp_millis();

        collection
            .update_one(
                doc! { "_id": file_id },
                doc! {
                    "$set": {
                        "appData.imageProcessor.status": "finished",
                        "appData.imageProcessor.finishedAt": current_time,
                        "appData.imageProcessor.error": error,
                        "appData.imageProcessor.result": bson::to_bson(&result)?,
                    }
                },
                None,
            )
            .await?;

        Ok(())
    }
}
