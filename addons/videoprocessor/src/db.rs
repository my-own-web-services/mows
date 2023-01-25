use crate::types::FilezFile;
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

    pub async fn dev_clear_video_processor_app_data(&self) -> anyhow::Result<()> {
        let collection = self.db.collection::<FilezFile>("files");
        collection
            .update_many(
                doc! {
                    "appData.videoProcessor": {
                        "$exists": true
                    }
                },
                doc! {
                    "$unset": {
                        "appData.videoProcessor": ""
                    }
                },
                None,
            )
            .await?;
        Ok(())
    }

    pub async fn get_video_for_processing(&self) -> anyhow::Result<Option<FilezFile>> {
        let collection = self.db.collection::<FilezFile>("files");

        let current_time = chrono::offset::Utc::now().timestamp_millis();

        let file = collection
            .find_one_and_update(
                doc! {
                    "$and":[
                        {
                            "mimeType":{
                                "$regex": "^video/"
                            }
                        },
                        {
                            "appData.videoProcessor.status": {
                                "$exists": false
                            }
                        }
                    ]
                },
                doc! {
                    "$set": {
                        "appData.videoProcessor.status": "processing",
                        "appData.videoProcessor.startedAt": current_time
                    }
                },
                None,
            )
            .await?;

        Ok(file)
    }

    pub async fn update_video_processing_status(
        &self,
        file_id: &str,
        error: Option<String>,
    ) -> anyhow::Result<()> {
        let collection = self.db.collection::<FilezFile>("files");

        let current_time = chrono::offset::Utc::now().timestamp_millis();

        collection
            .update_one(
                doc! { "_id": file_id },
                doc! {
                    "$set": {
                        "appData.videoProcessor.status": "finished",
                        "appData.videoProcessor.finishedAt": current_time,
                        "appData.videoProcessor.error": error
                    }
                },
                None,
            )
            .await?;

        Ok(())
    }
}
