use crate::{image_types::ProcessedImage, types::FilezFile};
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
                    "appData.image": {
                        "$exists": true
                    }
                },
                doc! {
                    "$unset": {
                        "appData.image": ""
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
                            "mimeType": {
                                "$regex": "^(image|audio|video)/"
                            }
                        },
                        {
                            "$or": [
                                {
                                    "appData.image.status": {
                                        "$exists": false
                                    }
                                },
                                {
                                    "appData.image.rescan": {
                                        "$eq": true
                                    }
                                }
                            ]

                        }
                    ]
                },
                doc! {
                    "$set": {
                        "appData.image.status": "processing",
                        "appData.image.startedAt": current_time,
                        "appData.image.rescan": false
                    }
                },
                None,
            )
            .await?;

        Ok(file)
    }

    pub async fn update_image_processing_status_finished(
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
                        "appData.image.status": "finished",
                        "appData.image.finishedAt": current_time,
                        "appData.image.error": error,
                        "appData.image.result": bson::to_bson(&result)?
                    }
                },
                None,
            )
            .await?;

        Ok(())
    }
}
