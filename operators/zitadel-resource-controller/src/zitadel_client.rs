use std::collections::HashMap;

use crate::credential_targets::handle_client_data_target;
use crate::resource_types::{
    api_auth_method_type_to_zitadel, duration_to_zitadel, RawZitadelAction, RawZitadelActionFlow,
    RawZitadelApplicationApi, RawZitadelApplicationClientDataTarget, RawZitadelApplicationOidc,
    RawZitadelProjectRole,
};
use crate::ControllerError;
use crate::config::config;
use mows_common_rust::get_current_config_cloned;
use serde_json::json;
use tonic::{service::interceptor::InterceptedService, transport::Channel};
use tracing::{debug, instrument};
use zitadel::api::zitadel::app::v1::App;
use zitadel::api::zitadel::management;
use zitadel::api::zitadel::management::v1::SetTriggerActionsRequest;
use zitadel::api::zitadel::org::v1::Org;
use zitadel::api::zitadel::user::v2::User;
use zitadel::api::{
    clients::{ChannelConfig, ClientBuilder},
    interceptors::AccessTokenInterceptor,
    zitadel::{
        admin::v1::admin_service_client::AdminServiceClient,
        management::v1::management_service_client::ManagementServiceClient,
        user::v2::user_service_client::UserServiceClient,
    },
};

pub type ManagementClient = ManagementServiceClient<InterceptedService<Channel, AccessTokenInterceptor>>;
pub type AdminClient = AdminServiceClient<InterceptedService<Channel, AccessTokenInterceptor>>;
pub type UserClient = UserServiceClient<InterceptedService<Channel, AccessTokenInterceptor>>;

#[derive(Clone, Debug)]
pub struct ZitadelClient {
    pub api_endpoint: String,
    pub pa_token: String,
    pub external_origin: String,
}

impl ZitadelClient {
    #[instrument(level = "trace", skip_all)]
    pub async fn new() -> anyhow::Result<ZitadelClient> {
        let config = get_current_config_cloned!(config());

        Ok(ZitadelClient {
            api_endpoint: config.zitadel_api_endpoint,
            pa_token: config.zitadel_pa_token,
            external_origin: config.zitadel_external_origin,
        })
    }

    #[instrument(level = "trace", skip(self))]
    pub async fn management_client(&self, org_id: Option<&str>) -> anyhow::Result<ManagementClient> {
        let client_builder =
            ClientBuilder::new(&self.api_endpoint).with_access_token_and_org(&self.pa_token.trim(), org_id);

        let channel_config = ChannelConfig {
            origin: self.external_origin.to_string(),
        };

        client_builder
            .build_management_client(&channel_config)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to create client: {}", e))
    }

    #[instrument(level = "trace", skip(self))]
    pub async fn admin_client(&self, org_id: Option<&str>) -> anyhow::Result<AdminClient> {
        let client_builder =
            ClientBuilder::new(&self.api_endpoint).with_access_token_and_org(&self.pa_token.trim(), org_id);

        let channel_config = ChannelConfig {
            origin: self.external_origin.to_string(),
        };

        client_builder
            .build_admin_client(&channel_config)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to create client: {}", e))
    }

    #[instrument(level = "trace", skip(self))]
    pub async fn user_client(&self, org_id: Option<&str>) -> anyhow::Result<UserClient> {
        let client_builder =
            ClientBuilder::new(&self.api_endpoint).with_access_token_and_org(&self.pa_token.trim(), org_id);

        let channel_config = ChannelConfig {
            origin: self.external_origin.to_string(),
        };

        client_builder
            .build_user_client(&channel_config)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to create client: {}", e))
    }

    #[instrument(level = "trace", skip(self))]
    pub async fn apply_org(&self, org_name: &str) -> anyhow::Result<String> {
        use zitadel::api::zitadel::admin::v1::ListOrgsRequest;
        use zitadel::api::zitadel::org::v1::org_query::Query::NameQuery;
        use zitadel::api::zitadel::org::v1::OrgNameQuery;
        use zitadel::api::zitadel::org::v1::OrgQuery;
        use zitadel::api::zitadel::v1::ListQuery;

        let mut admin_client = self.admin_client(None).await?;

        let org_id = match admin_client
            .list_orgs(ListOrgsRequest {
                query: Some(ListQuery {
                    limit: 1,
                    ..Default::default()
                }),
                queries: vec![OrgQuery {
                    query: Some(NameQuery(OrgNameQuery {
                        name: org_name.to_string(),
                        ..Default::default()
                    })),
                }],
                ..Default::default()
            })
            .await?
            .into_inner()
            .result
            .into_iter()
            .next()
        {
            Some(org) => org.id,
            None => {
                let mut management_client = self.management_client(None).await?;

                let response = management_client
                    .add_org(zitadel::api::zitadel::management::v1::AddOrgRequest {
                        name: org_name.to_string(),
                        ..Default::default()
                    })
                    .await?;

                response.into_inner().id
            }
        };

        Ok(org_id)
    }

    #[instrument(level = "trace", skip(self))]
    pub async fn apply_project(
        &self,
        org_id: &str,
        project_name: &str,
        project_role_assertion: bool,
        project_role_check: bool,
    ) -> anyhow::Result<String> {
        use zitadel::api::zitadel::management::v1::AddProjectRequest;
        use zitadel::api::zitadel::management::v1::ListProjectsRequest;
        use zitadel::api::zitadel::project::v1::project_query::Query::NameQuery;
        use zitadel::api::zitadel::project::v1::ProjectNameQuery;
        use zitadel::api::zitadel::project::v1::ProjectQuery;
        use zitadel::api::zitadel::v1::ListQuery;

        let mut management_client = self.management_client(Some(org_id)).await?;

        let project_id = match management_client
            .list_projects(ListProjectsRequest {
                query: Some(ListQuery {
                    limit: 1,
                    ..Default::default()
                }),
                queries: vec![ProjectQuery {
                    query: Some(NameQuery(ProjectNameQuery {
                        name: project_name.to_string(),
                        ..Default::default()
                    })),
                }],
            })
            .await?
            .into_inner()
            .result
            .into_iter()
            .next()
        {
            Some(project) => project.id,
            None => {
                let response = management_client
                    .add_project(AddProjectRequest {
                        name: project_name.to_string(),
                        project_role_assertion,
                        project_role_check,
                        has_project_check: true,
                        ..Default::default()
                    })
                    .await?;

                response.into_inner().id
            }
        };

        Ok(project_id)
    }

    #[instrument(level = "trace", skip(self))]
    pub async fn apply_project_roles(
        &self,
        org_id: &str,
        project_id: &str,
        resource_roles: &Vec<RawZitadelProjectRole>,
    ) -> anyhow::Result<()> {
        use zitadel::api::zitadel::management::v1::AddProjectRoleRequest;
        use zitadel::api::zitadel::management::v1::ListProjectRolesRequest;

        let mut management_client = self.management_client(Some(org_id)).await?;

        let project_role_list: Vec<_> = management_client
            .list_project_roles(ListProjectRolesRequest {
                project_id: project_id.to_string(),
                ..Default::default()
            })
            .await?
            .into_inner()
            .result;

        for resource_role in resource_roles.iter() {
            if !project_role_list.iter().any(|role| role.key == resource_role.key) {
                management_client
                    .add_project_role(AddProjectRoleRequest {
                        project_id: project_id.to_string(),
                        role_key: resource_role.key.clone(),
                        display_name: resource_role.display_name.clone(),
                        group: resource_role.group.clone(),
                    })
                    .await?;
            }
        }

        Ok(())
    }

    #[instrument(level = "trace", skip(self))]
    pub async fn get_admin_org(&self) -> anyhow::Result<Org> {
        use zitadel::api::zitadel::admin::v1::ListOrgsRequest;
        use zitadel::api::zitadel::org::v1::org_query::Query::NameQuery;
        use zitadel::api::zitadel::org::v1::OrgNameQuery;
        use zitadel::api::zitadel::org::v1::OrgQuery;
        use zitadel::api::zitadel::v1::ListQuery;

        let mut admin_client = self.admin_client(None).await?;

        let org = admin_client
            .list_orgs(ListOrgsRequest {
                query: Some(ListQuery {
                    limit: 1,
                    ..Default::default()
                }),
                queries: vec![OrgQuery {
                    query: Some(NameQuery(OrgNameQuery {
                        name: "ZITADEL".to_string(),
                        ..Default::default()
                    })),
                }],
                ..Default::default()
            })
            .await?
            .into_inner()
            .result
            .into_iter()
            .next()
            .ok_or(ControllerError::GenericError("No admin org found".to_string()))?;

        Ok(org)
    }

    #[instrument(level = "trace", skip(self))]
    pub async fn apply_admin_org_project_grant(
        &self,
        project_org_id: &str,
        admin_org_id: &str,
        project_id: &str,
        admin_roles: &Vec<String>,
    ) -> anyhow::Result<String> {
        use zitadel::api::zitadel::management::v1::ListProjectGrantsRequest;
        use zitadel::api::zitadel::project::v1::GrantRoleKeyQuery;
        use zitadel::api::zitadel::project::v1::ProjectGrantQuery;
        use zitadel::api::zitadel::v1::ListQuery;

        let mut management_client = self.management_client(Some(project_org_id)).await?;

        let project_grant_queries = admin_roles
            .iter()
            .map(|role_key| ProjectGrantQuery {
                query: Some(
                    zitadel::api::zitadel::project::v1::project_grant_query::Query::RoleKeyQuery(
                        GrantRoleKeyQuery {
                            role_key: role_key.clone(),
                            ..Default::default()
                        },
                    ),
                ),
            })
            .collect::<Vec<_>>();

        let project_grant_id = match management_client
            .list_project_grants(ListProjectGrantsRequest {
                project_id: project_id.to_string(),
                query: Some(ListQuery {
                    limit: 1,
                    ..Default::default()
                }),
                queries: project_grant_queries,
            })
            .await?
            .into_inner()
            .result
            .into_iter()
            .next()
        {
            Some(project_grant) => project_grant.grant_id,
            None => {
                management_client
                    .add_project_grant(zitadel::api::zitadel::management::v1::AddProjectGrantRequest {
                        project_id: project_id.to_string(),
                        role_keys: admin_roles.clone(),
                        granted_org_id: admin_org_id.to_string(),
                    })
                    .await?
                    .into_inner()
                    .grant_id
            }
        };

        Ok(project_grant_id)
    }

    #[instrument(level = "trace", skip(self))]
    pub async fn get_admin_user(&self, admin_org: &Org) -> anyhow::Result<User> {
        use zitadel::api::zitadel::user::v2::search_query::Query;
        use zitadel::api::zitadel::user::v2::ListUsersRequest;
        use zitadel::api::zitadel::user::v2::SearchQuery;
        use zitadel::api::zitadel::user::v2::UserNameQuery;

        let mut user_client = self.user_client(Some(&admin_org.id)).await?;

        let admin_name = format!("zitadel-admin@{}", admin_org.primary_domain);

        debug!("admin_name: {}", admin_name);

        let users = user_client
            .list_users(ListUsersRequest {
                queries: vec![SearchQuery {
                    query: Some(Query::UserNameQuery(UserNameQuery {
                        user_name: admin_name.clone(),
                        ..Default::default()
                    })),
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

        Ok(admin_user)
    }

    #[instrument(level = "trace", skip(self))]
    pub async fn apply_admin_grant(
        &self,
        project_org_id: &str,
        project_id: &str,
        admin_user_id: &str,
        admin_roles: &Vec<String>,
    ) -> anyhow::Result<()> {
        use zitadel::api::zitadel::management::v1::AddUserGrantRequest;
        use zitadel::api::zitadel::management::v1::ListUserGrantRequest;
        use zitadel::api::zitadel::user::v1::user_grant_query::Query;
        use zitadel::api::zitadel::user::v1::UserGrantQuery;
        use zitadel::api::zitadel::user::v1::UserGrantUserIdQuery;
        use zitadel::api::zitadel::v1::ListQuery;

        let mut management_client = self.management_client(Some(project_org_id)).await?;
        if management_client
            .list_user_grants(ListUserGrantRequest {
                query: Some(ListQuery {
                    limit: 1,
                    ..Default::default()
                }),
                queries: vec![UserGrantQuery {
                    query: Some(Query::UserIdQuery(UserGrantUserIdQuery {
                        user_id: admin_user_id.to_string(),
                    })),
                }],
            })
            .await?
            .into_inner()
            .result
            .into_iter()
            .next()
            .is_none()
        {
            management_client
                .add_user_grant(AddUserGrantRequest {
                    user_id: admin_user_id.to_string(),
                    project_id: project_id.to_string(),
                    role_keys: admin_roles.clone(),
                    project_grant_id: "".to_string(),
                })
                .await?;
        }

        Ok(())
    }

    #[instrument(level = "trace", skip(self))]
    pub async fn get_project_applications(
        &self,
        project_org_id: &str,
        project_id: &str,
    ) -> anyhow::Result<Vec<App>> {
        use zitadel::api::zitadel::management::v1::ListAppsRequest;
        use zitadel::api::zitadel::v1::ListQuery;

        let mut management_client = self.management_client(Some(project_org_id)).await?;

        let apps = management_client
            .list_apps(ListAppsRequest {
                project_id: project_id.to_string(),
                query: Some(ListQuery { ..Default::default() }),
                ..Default::default()
            })
            .await?;

        Ok(apps.into_inner().result)
    }

    #[instrument(level = "trace", skip(self))]
    pub async fn apply_api_application(
        &self,
        resource_scope: &str,
        project_org_id: &str,
        project_id: &str,
        application_name: &str,
        api_config: &RawZitadelApplicationApi,
        client_data_target: &RawZitadelApplicationClientDataTarget,
    ) -> anyhow::Result<()> {
        use zitadel::api::zitadel::management::v1::AddApiAppRequest;

        let mut management_client = self.management_client(Some(project_org_id)).await?;

        // check if we can create the client data target
        handle_client_data_target(
            client_data_target,
            resource_scope,
            json!({"test": "test"}),
        )
        .await?;

        let api_app = management_client
            .add_api_app(AddApiAppRequest {
                project_id: project_id.to_string(),
                name: application_name.to_string(),
                auth_method_type: api_auth_method_type_to_zitadel(&api_config.authentication_method),

                ..Default::default()
            })
            .await?
            .into_inner();

        // store credentials in the configured target
        if let Err(e) = handle_client_data_target(
            client_data_target,
            resource_scope,
            json!({
                "clientId": api_app.client_id,
                "clientSecret": api_app.client_secret
            }),
        )
        .await
        {
            // if credential storage fails we need to remove the app to not leave it in an inconsistent state
            if let Err(remove_err) = management_client
                .remove_app(zitadel::api::zitadel::management::v1::RemoveAppRequest {
                    app_id: api_app.app_id.clone(),
                    project_id: project_id.to_string(),
                })
                .await
            {
                tracing::error!(
                    "INCONSISTENCY: Failed to remove app after credential storage failed: {}",
                    remove_err
                );
            }

            return Err(e.into());
        }

        Ok(())
    }

    #[instrument(level = "trace", skip(self))]
    pub async fn apply_oidc_application(
        &self,
        resource_scope: &str,
        project_org_id: &str,
        project_id: &str,
        application_name: &str,
        oidc_config: &RawZitadelApplicationOidc,
        client_data_target: &RawZitadelApplicationClientDataTarget,
    ) -> anyhow::Result<()> {
        use crate::resource_types::oidc_access_token_type_to_zitadel;
        use crate::resource_types::oidc_app_type_to_zitadel;
        use crate::resource_types::oidc_auth_method_type_to_zitadel;
        use crate::resource_types::oidc_grant_type_to_zitadel;
        use crate::resource_types::oidc_response_type_to_zitadel;
        use zitadel::api::zitadel::management::v1::AddOidcAppRequest;
        use zitadel::api::zitadel::management::v1::RemoveAppRequest;

        let mut management_client = self.management_client(Some(project_org_id)).await?;

        // check if we can create the client data target
        handle_client_data_target(
            client_data_target,
            resource_scope,
            json!({"test": "test"}),
        )
        .await?;

        let oidc_app = management_client
            .add_oidc_app(AddOidcAppRequest {
                project_id: project_id.to_string(),
                name: application_name.to_string(),

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
                auth_method_type: oidc_auth_method_type_to_zitadel(&oidc_config.authentication_method),
                post_logout_redirect_uris: oidc_config.post_logout_redirect_uris.clone(),
                access_token_type: oidc_access_token_type_to_zitadel(&oidc_config.access_token_type),
                id_token_role_assertion: oidc_config.id_token_role_assertion.unwrap_or_default(),
                id_token_userinfo_assertion: oidc_config
                    .id_token_userinfo_assertion
                    .unwrap_or_default(),
                dev_mode: oidc_config.dev_mode.unwrap_or(false),

                ..Default::default()
            })
            .await?
            .into_inner();

        // store credentials in the configured target
        if let Err(e) = handle_client_data_target(
            client_data_target,
            resource_scope,
            json!({
                "clientId": oidc_app.client_id,
                "clientSecret": oidc_app.client_secret
            }),
        )
        .await
        {
            // if credential storage fails we need to remove the app to not leave it in an inconsistent state
            if let Err(remove_err) = management_client
                .remove_app(RemoveAppRequest {
                    app_id: oidc_app.app_id.clone(),
                    project_id: project_id.to_string(),
                })
                .await
            {
                tracing::error!(
                    "INCONSISTENCY: Failed to remove app after credential storage failed: {}",
                    remove_err
                );
            }

            return Err(e.into());
        }

        Ok(())
    }

    #[instrument(level = "trace", skip(self))]
    pub async fn apply_actions(
        &self,
        project_org_id: &str,
        actions: &HashMap<String, RawZitadelAction>,
    ) -> anyhow::Result<HashMap<String, String>> {
        let mut action_ids = HashMap::new();

        for (action_name, action) in actions.iter() {
            let action_id = self.apply_action(project_org_id, action_name, action).await?;
            action_ids.insert(action_name.clone(), action_id);
        }

        Ok(action_ids)
    }

    #[instrument(level = "trace", skip(self))]
    pub async fn apply_action(
        &self,
        project_org_id: &str,
        action_name: &str,
        action: &RawZitadelAction,
    ) -> anyhow::Result<String> {
        use zitadel::api::zitadel::action::v1::ActionNameQuery;
        use zitadel::api::zitadel::management::v1::action_query::Query;
        use zitadel::api::zitadel::management::v1::ActionQuery;
        use zitadel::api::zitadel::management::v1::CreateActionRequest;
        use zitadel::api::zitadel::management::v1::ListActionsRequest;
        use zitadel::api::zitadel::v1::ListQuery;
        let mut management_client = self.management_client(Some(project_org_id)).await?;

        Ok(
            match management_client
                .list_actions(ListActionsRequest {
                    query: Some(ListQuery {
                        limit: 1,
                        ..Default::default()
                    }),
                    queries: vec![ActionQuery {
                        query: Some(Query::ActionNameQuery(ActionNameQuery {
                            name: action_name.to_string(),
                            ..Default::default()
                        })),
                    }],
                    ..Default::default()
                })
                .await?
                .into_inner()
                .result
                .into_iter()
                .next()
            {
                Some(action) => action.id,
                None => {
                    management_client
                        .create_action(CreateActionRequest {
                            name: action_name.to_string(),
                            allowed_to_fail: action.allowed_to_fail.unwrap_or_default(),
                            script: action.script.clone(),
                            timeout: action.timeout_seconds.map(duration_to_zitadel),
                        })
                        .await?
                        .into_inner()
                        .id
                }
            },
        )
    }

    #[instrument(level = "trace", skip(self))]
    pub async fn apply_flow(
        &self,
        project_org_id: &str,
        flow_to_apply: &RawZitadelActionFlow,
        action_names_and_ids: &HashMap<String, String>,
    ) -> anyhow::Result<()> {
        use crate::resource_types::RawZitadelActionFlowComplementTokenEnum;
        use crate::resource_types::RawZitadelActionFlowEnum;
        use crate::zitadel_client::management::v1::GetFlowRequest;

        let mut management_client = self.management_client(Some(project_org_id)).await?;

        if let Some(complement_token_flow) = flow_to_apply.complement_token.as_ref() {
            let flow_type = RawZitadelActionFlowEnum::ComplementToken.as_zitadel_id();

            if let Some(current_flow) = management_client
                .get_flow(GetFlowRequest {
                    r#type: flow_type.to_string(),
                })
                .await?
                .into_inner()
                .flow
            {
                if let Some(pre_userinfo_creation) = &complement_token_flow.pre_userinfo_creation {
                    let pre_userinfo_creation_exists =
                        current_flow.trigger_actions.iter().any(|trigger_action| {
                            trigger_action.trigger_type.as_ref().map(|trigger_type| {
                                trigger_type.id
                                    == RawZitadelActionFlowComplementTokenEnum::PreUserinfoCreation
                                        .as_zitadel_id()
                            }) == Some(true)
                        });

                    if !pre_userinfo_creation_exists {
                        debug!("Applying trigger actions for pre_userinfo_creation");

                        let action_ids = action_names_and_ids
                            .iter()
                            .filter_map(|(action_name, action_id)| {
                                if pre_userinfo_creation.contains(action_name) {
                                    Some(action_id.clone())
                                } else {
                                    None
                                }
                            })
                            .collect::<Vec<_>>();

                        management_client
                            .set_trigger_actions(SetTriggerActionsRequest {
                                trigger_type: RawZitadelActionFlowComplementTokenEnum::PreUserinfoCreation
                                    .as_zitadel_id()
                                    .to_string(),
                                flow_type: flow_type.to_string(),
                                action_ids,
                            })
                            .await?;
                    }
                }

                if let Some(pre_access_token_creation) = &complement_token_flow.pre_access_token_creation {
                    let pre_access_token_creation_exists =
                        current_flow.trigger_actions.iter().any(|trigger_action| {
                            trigger_action.trigger_type.as_ref().map(|trigger_type| {
                                trigger_type.id
                                    == RawZitadelActionFlowComplementTokenEnum::PreAccessTokenCreation
                                        .as_zitadel_id()
                            }) == Some(true)
                        });

                    if !pre_access_token_creation_exists {
                        debug!("Applying trigger actions for pre_access_token_creation");

                        let action_ids = action_names_and_ids
                            .iter()
                            .filter_map(|(action_name, action_id)| {
                                if pre_access_token_creation.contains(action_name) {
                                    Some(action_id.clone())
                                } else {
                                    None
                                }
                            })
                            .collect::<Vec<_>>();

                        management_client
                            .set_trigger_actions(SetTriggerActionsRequest {
                                trigger_type: RawZitadelActionFlowComplementTokenEnum::PreAccessTokenCreation
                                    .as_zitadel_id()
                                    .to_string(),
                                flow_type: flow_type.to_string(),
                                action_ids,
                            })
                            .await?;
                    }
                }
            }
        }

        Ok(())
    }

    #[instrument(level = "trace", skip(self))]
    pub async fn delete_org(&self, org_id: &str) -> anyhow::Result<()> {
        use zitadel::api::zitadel::admin::v1::RemoveOrgRequest;
        let mut admin_client = self.admin_client(None).await?;

        admin_client
            .remove_org(RemoveOrgRequest {
                org_id: org_id.to_string(),
            })
            .await?;

        Ok(())
    }

    #[instrument(level = "trace", skip(self))]
    pub async fn get_org_by_name(&self, org_name: &str) -> anyhow::Result<Org> {
        use zitadel::api::zitadel::admin::v1::ListOrgsRequest;
        use zitadel::api::zitadel::org::v1::org_query::Query::NameQuery;
        use zitadel::api::zitadel::org::v1::OrgNameQuery;
        use zitadel::api::zitadel::org::v1::OrgQuery;
        use zitadel::api::zitadel::v1::ListQuery;

        let mut admin_client = self.admin_client(None).await?;

        let org = admin_client
            .list_orgs(ListOrgsRequest {
                query: Some(ListQuery {
                    limit: 1,
                    ..Default::default()
                }),
                queries: vec![OrgQuery {
                    query: Some(NameQuery(OrgNameQuery {
                        name: org_name.to_string(),
                        ..Default::default()
                    })),
                }],
                ..Default::default()
            })
            .await?
            .into_inner()
            .result
            .into_iter()
            .next()
            .ok_or(ControllerError::GenericError("No org found".to_string()))?;

        Ok(org)
    }
}
