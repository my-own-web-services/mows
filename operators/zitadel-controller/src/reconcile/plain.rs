use ::zitadel::api::zitadel::management::v1::AddOrgRequest;
use mows_common::{get_current_config_cloned, reqwest::new_reqwest_client};
use serde_json::{json, Value};
use tracing::{debug, instrument};
use zitadel::api::zitadel;

use crate::{
    config::config,
    crd::{self, PlainZitadelResource},
    utils::create_new_zitadel_management_client,
    Error,
};

pub async fn handle_plain(plain_resource: &PlainZitadelResource) -> Result<(), Error> {
    let mut client = create_new_zitadel_management_client().await?;
    let config = get_current_config_cloned!(config());

    match &plain_resource.resource {
        crd::PlainZitadelResourceSelector::Org(plain_zitadel_org) => {
            client
                .add_org(AddOrgRequest {
                    name: plain_zitadel_org.name.clone(),
                })
                .await?;
        }
        crd::PlainZitadelResourceSelector::Project(plain_zitadel_project) => todo!(),
    };

    Ok(())
}
