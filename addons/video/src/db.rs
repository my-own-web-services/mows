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
}
