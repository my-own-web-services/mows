use crate::image_types::ProcessedImage;
use filez_common::server::FilezFile;
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
                    "app_data.image": {
                        "$exists": true
                    }
                },
                doc! {
                    "$unset": {
                        "app_data.image": ""
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
                            "mime_type": {
                                "$regex": "^(image|audio|video)/"
                            }
                        },
                        {
                            "$or": [
                                {
                                    "app_data.image.status": {
                                        "$exists": false
                                    }
                                },
                                {
                                    "app_data.image.rescan": {
                                        "$eq": true
                                    }
                                }
                            ]

                        }
                    ]
                },
                doc! {
                    "$set": {
                        "app_data.image.status": "processing",
                        "app_data.image.started_at": current_time,
                        "app_data.image.rescan": false
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
                        "app_data.image.status": "finished",
                        "app_data.image.finished_at": current_time,
                        "app_data.image.error": error,
                        "app_data.image.result": bson::to_bson(&result)?
                    }
                },
                None,
            )
            .await?;

        Ok(())
    }
}
