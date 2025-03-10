use crate::{
    crd::{self, RawZitadelResource},
    utils::ZitadelClient,
    ControllerError,
};
use ::zitadel::api::zitadel::management::v1::AddOrgRequest;
use zitadel::api::zitadel::{admin::v1::ListOrgsRequest, management::v1::AddProjectRequest};

pub async fn handle_raw(raw_resource: &RawZitadelResource) -> Result<(), ControllerError> {
    let client = ZitadelClient::new().await?;

    match &raw_resource.resource {
        crd::RawZitadelResourceSelector::Org(raw_zitadel_org) => {
            let mut client = client.management_client(None).await?;

            client
                .add_org(AddOrgRequest {
                    name: raw_zitadel_org.name.clone(),
                })
                .await?;
        }
        crd::RawZitadelResourceSelector::Project(raw_zitadel_project) => {
            let mut admin_client = client.admin_client(None).await?;

            let orgs = admin_client.list_orgs(ListOrgsRequest::default()).await?;
            let org = orgs
                .into_inner()
                .result
                .into_iter()
                .find(|org| org.name == raw_zitadel_project.org_name)
                .ok_or_else(|| ZitadelResourceRawError::OrgNotFound(raw_zitadel_project.org_name.clone()))?;

            let mut management_client = client.management_client(Some(&org.id)).await?;

            management_client
                .add_project(AddProjectRequest {
                    name: raw_zitadel_project.name.clone(),
                    ..Default::default()
                })
                .await?;
        }
    };

    Ok(())
}

#[derive(thiserror::Error, Debug)]
pub enum ZitadelResourceRawError {
    #[error("Org not found: {0}")]
    OrgNotFound(String),
}
