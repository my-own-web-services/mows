use crate::{
    crd::{self, RawZitadelResource},
    utils::ZitadelClient,
    ControllerError,
};
use ::zitadel::api::zitadel::management::v1::AddOrgRequest;
use vaultrs::api::auth::userpass::requests::ListUsersRequest;
use zitadel::api::zitadel::{
    admin::v1::ListOrgsRequest,
    management::v1::{AddProjectRequest, AddProjectRoleRequest, ListProjectsRequest},
};

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

            // create project

            let project_list = management_client
                .list_projects(ListProjectsRequest::default())
                .await?;

            let project_id = match project_list
                .into_inner()
                .result
                .into_iter()
                .find(|project| project.name == raw_zitadel_project.name)
            {
                Some(project) => project.id,
                None => {
                    let response = management_client
                        .add_project(AddProjectRequest {
                            name: raw_zitadel_project.name.clone(),
                            project_role_assertion: raw_zitadel_project.project_role_assertion.clone(),
                            project_role_check: raw_zitadel_project.project_role_check.clone(),
                            has_project_check: true,
                            ..Default::default()
                        })
                        .await?;

                    response.into_inner().id
                }
            };

            // create roles

            let mut project_role_list = management_client
                .list_project_roles(zitadel::api::zitadel::management::v1::ListProjectRolesRequest {
                    project_id: project_id.clone(),
                    ..Default::default()
                })
                .await?
                .into_inner()
                .result
                .into_iter();

            for resource_role in raw_zitadel_project.roles.iter() {
                if project_role_list.find(|project_role| project_role.key == resource_role.key) == None {
                    management_client
                        .add_project_role(AddProjectRoleRequest {
                            project_id: project_id.clone(),
                            role_key: resource_role.key.clone(),
                            display_name: resource_role.display_name.clone(),
                            group: resource_role.group.clone(),
                        })
                        .await?;
                };
            }

            // assign roles to admin

            let user_client = client.user_client(None).await?;

            //let users = user_client.list_users(ListUsersRequest::default()).await?;
        }
    };

    Ok(())
}

#[derive(thiserror::Error, Debug)]
pub enum ZitadelResourceRawError {
    #[error("Org not found: {0}")]
    OrgNotFound(String),
}
