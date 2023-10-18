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
                    "app_data.video": {
                        "$exists": true
                    }
                },
                doc! {
                    "$unset": {
                        "app_data.video": ""
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
                    "$and": [
                        {
                            "mime_type": {
                                "$regex": "^video/"
                            }
                        },
                        {
                            "$or": [
                            {
                                "app_data.video.status": {
                                    "$exists": false
                                }
                            },
                            {
                                "app_data.video.rescan": {
                                    "$eq": true
                                }
                            }
                           ]
                        }
                    ]
                },
                doc! {
                    "$set": {
                        "app_data.video.status": "processing",
                        "app_data.video.started_at": current_time
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
                        "app_data.video.status": "finished",
                        "app_data.video.finished_at": current_time,
                        "app_data.video.error": error
                    }
                },
                None,
            )
            .await?;

        Ok(())
    }
}
