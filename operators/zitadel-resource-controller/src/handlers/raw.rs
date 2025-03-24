use crate::{
    crd::{
        self, oidc_access_token_type_to_zitadel, oidc_app_type_to_zitadel, oidc_auth_method_type_to_zitadel,
        oidc_grant_type_to_zitadel, oidc_response_type_to_zitadel, ClientDataTargetVault, RawZitadelResource,
    },
    utils::{create_vault_client, ZitadelClient},
    ControllerError,
};
use ::zitadel::api::zitadel::management::v1::AddOrgRequest;
use anyhow::bail;
use serde_json::json;
use tracing::debug;
use vaultrs::client::VaultClient;
use zitadel::api::zitadel::{
    admin::v1::ListOrgsRequest,
    management::v1::{
        AddOidcAppRequest, AddProjectRequest, AddProjectRoleRequest, AddUserGrantRequest,
        ListProjectGrantsRequest, ListProjectsRequest,
    },
    org::v1::{org_query, OrgNameQuery, OrgQuery},
    project::v1::{project_query, ProjectNameQuery, ProjectQuery},
    user::v2::{ListUsersRequest, UserNameQuery},
    v1::ListQuery,
};

use mows_common::s;

pub async fn handle_raw(
    resource_namespace: &str,
    raw_resource: &RawZitadelResource,
) -> Result<(), ControllerError> {
    let client = ZitadelClient::new().await?;

    match &raw_resource.resource {
        crd::RawZitadelResourceSelector::Org(raw_zitadel_org) => {
            let mut management_client = client.management_client(None).await?;

            let mut admin_client = client.admin_client(None).await?;

            let orgs = admin_client
                .list_orgs(ListOrgsRequest {
                    query: Some(ListQuery {
                        limit: 1,
                        ..Default::default()
                    }),
                    queries: vec![OrgQuery {
                        query: Some(org_query::Query::NameQuery(OrgNameQuery {
                            name: raw_zitadel_org.name.clone(),
                            ..Default::default()
                        })),
                    }],
                    ..Default::default()
                })
                .await?;

            let orgs = orgs.into_inner().result;

            if orgs
                .into_iter()
                .find(|org| org.name == raw_zitadel_org.name)
                .is_none()
            {
                management_client
                    .add_org(AddOrgRequest {
                        name: raw_zitadel_org.name.clone(),
                    })
                    .await?;
            }
        }
        crd::RawZitadelResourceSelector::Project(raw_zitadel_project) => {
            let mut admin_client = client.admin_client(None).await?;

            let orgs = admin_client.list_orgs(ListOrgsRequest::default()).await?;
            let orgs = orgs.into_inner().result;

            let org = orgs
                .clone()
                .into_iter()
                .find(|org| org.name == raw_zitadel_project.org_name)
                .ok_or_else(|| ZitadelResourceRawError::OrgNotFound(raw_zitadel_project.org_name.clone()))?;

            let mut management_client = client.management_client(Some(&org.id)).await?;

            // create project

            let project_list = management_client
                .list_projects(ListProjectsRequest {
                    query: Some(ListQuery {
                        limit: 1,
                        ..Default::default()
                    }),
                    queries: vec![ProjectQuery {
                        query: Some(project_query::Query::NameQuery(ProjectNameQuery {
                            name: raw_zitadel_project.name.clone(),
                            ..Default::default()
                        })),
                    }],
                })
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

            debug!("project_role_list: {:?}", project_role_list);

            for resource_role in raw_zitadel_project.roles.iter() {
                if project_role_list.find(|role| role.key == resource_role.key.clone()) == None {
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

            // get admin user_id
            let admin_org = orgs
                .into_iter()
                .find(|org| org.name == "ZITADEL")
                .ok_or(ControllerError::GenericError("Admin org not found".to_string()))?;

            let mut user_client = client.user_client(Some(&admin_org.id)).await?;
            let admin_name = format!("zitadel-admin@{}", admin_org.primary_domain);

            debug!("admin_name: {}", admin_name);

            let users = user_client
                .list_users(ListUsersRequest {
                    queries: vec![zitadel::api::zitadel::user::v2::SearchQuery {
                        query: Some(
                            zitadel::api::zitadel::user::v2::search_query::Query::UserNameQuery(
                                UserNameQuery {
                                    user_name: admin_name.clone(),
                                    ..Default::default()
                                },
                            ),
                        ),
                        ..Default::default()
                    }],
                    ..Default::default()
                })
                .await?;

            let admin_user = users
                .into_inner()
                .result
                .into_iter()
                .next()
                .ok_or(ControllerError::GenericError("No admin user found".to_string()))?;

            // assign roles to admin
            let user_grants_list = management_client
                .list_user_grants(zitadel::api::zitadel::management::v1::ListUserGrantRequest {
                    query: Some(ListQuery {
                        limit: 1,
                        ..Default::default()
                    }),
                    ..Default::default()
                })
                .await?
                .into_inner()
                .result;

            if user_grants_list
                .into_iter()
                .find(|grant| grant.user_id == admin_user.user_id)
                .is_none()
            {
                management_client
                    .add_user_grant(AddUserGrantRequest {
                        user_id: admin_user.user_id.clone(),
                        project_id: project_id.clone(),
                        role_keys: raw_zitadel_project.admin_roles.clone(),
                        project_grant_id: s!(""),
                    })
                    .await?;
            }

            // zitadel-admin@zitadel.zitadel.vindelicorum.eu

            let present_applications = management_client
                .list_apps(zitadel::api::zitadel::management::v1::ListAppsRequest {
                    project_id: project_id.clone(),
                    query: Some(ListQuery {
                        limit: 1,
                        ..Default::default()
                    }),
                    ..Default::default()
                })
                .await?
                .into_inner()
                .result;

            // create applications
            for resource_application in raw_zitadel_project.applications.iter() {
                if present_applications
                    .clone()
                    .into_iter()
                    .find(|present_application| present_application.name == resource_application.name)
                    .is_some()
                {
                    continue;
                }

                // create application
                match &resource_application.method {
                    crd::RawZitadelApplicationMethod::Oidc(oidc_config) => {
                        // check if we can create the client data target
                        match &resource_application.client_data_target {
                            crd::RawZitadelApplicationClientDataTarget::Vault(vault_target) => {
                                handle_vault_target(
                                    vault_target,
                                    resource_namespace,
                                    json!({
                                        "clientId": "test",
                                        "clientSecret": "test"
                                    }),
                                )
                                .await?;
                            }
                        }

                        let oidc_app = management_client
                            .add_oidc_app(AddOidcAppRequest {
                                project_id: project_id.clone(),
                                name: resource_application.name.clone(),

                                redirect_uris: oidc_config.redirect_uris.clone(),
                                response_types: oidc_config
                                    .response_types
                                    .iter()
                                    .map(oidc_response_type_to_zitadel)
                                    .collect(),
                                grant_types: oidc_config
                                    .grant_types
                                    .iter()
                                    .map(oidc_grant_type_to_zitadel)
                                    .collect(),
                                app_type: oidc_app_type_to_zitadel(&oidc_config.app_type),
                                auth_method_type: oidc_auth_method_type_to_zitadel(
                                    &oidc_config.authentication_method,
                                ),
                                post_logout_redirect_uris: oidc_config.post_logout_redirect_uris.clone(),
                                access_token_type: oidc_access_token_type_to_zitadel(
                                    &oidc_config.access_token_type,
                                ),
                                id_token_role_assertion: oidc_config
                                    .id_token_role_assertion
                                    .clone()
                                    .unwrap_or_default(),
                                id_token_userinfo_assertion: oidc_config
                                    .id_token_userinfo_assertion
                                    .clone()
                                    .unwrap_or_default(),

                                ..Default::default()
                            })
                            .await?
                            .into_inner();

                        // create client data target
                        match &resource_application.client_data_target {
                            crd::RawZitadelApplicationClientDataTarget::Vault(vault) => {
                                if let Err(e) = handle_vault_target(
                                    vault,
                                    resource_namespace,
                                    json!({
                                        "clientId": oidc_app.client_id,
                                        "clientSecret": oidc_app.client_secret
                                    }),
                                )
                                .await
                                {
                                    // DELETE APP
                                    return Err(e.into());
                                }
                            }
                        }
                    }
                    crd::RawZitadelApplicationMethod::Api(_) => todo!(),
                }
            }
        }
    };

    Ok(())
}

#[derive(thiserror::Error, Debug)]
pub enum ZitadelResourceRawError {
    #[error("Org not found: {0}")]
    OrgNotFound(String),
}

pub async fn handle_vault_target(
    vault_target: &ClientDataTargetVault,
    resource_namespace: &str,
    data: serde_json::Value,
) -> Result<(), ControllerError> {
    let auth_role = "zitadel-resource-controller";
    let auth_path = format!(
        "mows-core-secrets-vrc/{}/{}",
        resource_namespace, vault_target.kubernetes_auth_engine_name
    );
    let vault_client = create_vault_client(&auth_path, &auth_role).await?;

    let mount_path = format!(
        "mows-core-secrets-vrc/{}/{}",
        resource_namespace, vault_target.secret_engine_name
    );

    vaultrs::kv2::set(
        &vault_client,
        &mount_path,
        &vault_target.secret_engine_sub_path,
        &data,
    )
    .await?;
    Ok(())
}
