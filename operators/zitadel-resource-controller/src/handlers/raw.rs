use anyhow::Context;
use tracing::debug;

use crate::{
    resource_types::{self, RawZitadelResource},
    zitadel_client::ZitadelClient,
    ControllerError,
};

fn get_zitadel_project_name(resource_scope: &str, resource_name: &str) -> String {
    format!("zrc-{}-{}", resource_scope, resource_name)
}

pub async fn cleanup_raw(
    resource_scope: &str,
    resource_name: &str,
    raw_resource: &RawZitadelResource,
) -> Result<(), ControllerError> {
    let zitadel_client = ZitadelClient::new().await?;

    match &raw_resource.resource {
        resource_types::RawZitadelResourceSelector::Project(_) => {
            let project_name = get_zitadel_project_name(resource_scope, resource_name);

            debug!("Cleaning up Zitadel project: {}", project_name);

            let project_org = zitadel_client.get_org_by_name(&project_name).await?;

            zitadel_client.delete_org(&project_org.id).await?;
        }
    };

    debug!(
        "Cleaned up Zitadel resource: {} in scope: {}",
        resource_name, resource_scope
    );

    Ok(())
}

pub async fn apply_raw(
    resource_scope: &str,
    resource_name: &str,
    raw_resource: &RawZitadelResource,
) -> Result<(), ControllerError> {
    let zitadel_client = ZitadelClient::new().await?;

    match &raw_resource.resource {
        resource_types::RawZitadelResourceSelector::Project(raw_zitadel_project) => {
            let project_name = get_zitadel_project_name(resource_scope, resource_name);

            debug!(
                "Applying Zitadel project: {} in scope: {}",
                project_name, resource_scope
            );

            let project_org_id = zitadel_client.apply_org(&project_name).await.context(format!(
                "Failed to apply Zitadel project org for project: {} in scope: {}",
                project_name, resource_scope
            ))?;

            debug!(
                "Applied Zitadel project org: {} with ID: {}",
                project_name, project_org_id
            );

            if let Some(action_flow) = &raw_zitadel_project.action_flow {
                debug!(
                    "Applying action flow for project: {} with actions: {:?}",
                    project_name, action_flow.actions
                );

                let action_names_and_ids = zitadel_client
                    .apply_actions(&project_org_id, &action_flow.actions)
                    .await
                    .context(format!(
                        "Failed to apply actions for project: {} in scope: {}",
                        project_name, resource_scope
                    ))?;

                debug!(
                    "Applied actions for project: {} with names and IDs: {:?}",
                    project_name, action_names_and_ids
                );

                zitadel_client
                    .apply_flow(&project_org_id, &action_flow.flow, &action_names_and_ids)
                    .await
                    .context(format!(
                        "Failed to apply action flow for project: {} in scope: {}",
                        project_name, resource_scope
                    ))?;

                debug!(
                    "Applied action flow for project: {} with flow: {:?}",
                    project_name, action_flow.flow
                );
            }

            let project_id = zitadel_client
                .apply_project(
                    &project_org_id,
                    &project_name,
                    raw_zitadel_project.project_role_assertion,
                    raw_zitadel_project.project_role_check,
                )
                .await
                .context(format!(
                    "Failed to apply Zitadel project for project: {} in scope: {}",
                    project_name, resource_scope
                ))?;

            debug!(
                "Applied Zitadel project: {} with ID: {}",
                project_name, project_id
            );

            zitadel_client
                .apply_project_roles(&project_org_id, &project_id, &raw_zitadel_project.roles)
                .await
                .context(format!(
                    "Failed to apply project roles for project: {} in scope: {}",
                    project_name, resource_scope
                ))?;

            debug!(
                "Applied project roles for project: {} with ID: {}",
                project_name, project_id
            );

            let admin_org = zitadel_client.get_admin_org().await?;

            debug!(
                "Admin org for project: {} is: {} with ID: {}",
                project_name, admin_org.name, admin_org.id
            );

            zitadel_client
                .apply_admin_org_project_grant(
                    &project_org_id,
                    &admin_org.id,
                    &project_id,
                    &raw_zitadel_project.admin_roles,
                )
                .await
                .context(format!(
                    "Failed to apply admin org project grant for project: {} in scope: {}",
                    project_name, resource_scope
                ))?;

            debug!(
                "Applied admin org project grant for project: {} with ID: {}",
                project_name, project_id
            );

            let admin_user = zitadel_client.get_admin_user(&admin_org).await.context(format!(
                "Failed to get admin user for project: {} in scope: {}",
                project_name, resource_scope
            ))?;

            debug!("Admin user has id: {}", admin_user.user_id);

            zitadel_client
                .apply_admin_grant(
                    &project_org_id,
                    &project_id,
                    &admin_user.user_id,
                    &raw_zitadel_project.admin_roles,
                )
                .await
                .context(format!(
                    "Failed to apply admin grant for project: {} in scope: {}",
                    project_name, resource_scope
                ))?;

            debug!(
                "Applied admin grant for project: {} with ID: {}",
                project_name, project_id
            );

            let mut present_applications = zitadel_client
                .get_project_applications(&project_org_id, &project_id)
                .await
                .context(format!(
                    "Failed to get present applications for project: {} in scope: {}",
                    project_name, resource_scope
                ))?
                .into_iter();

            // create applications
            for resource_application in raw_zitadel_project.applications.iter() {
                if present_applications
                    .find(|present_application| present_application.name == resource_application.name)
                    .is_some()
                {
                    continue;
                }

                // create application
                match &resource_application.method {
                    resource_types::RawZitadelApplicationMethod::Oidc(oidc_config) => zitadel_client
                        .apply_oidc_application(
                            resource_scope,
                            &project_org_id,
                            &project_id,
                            &resource_application.name,
                            oidc_config,
                            &resource_application.client_data_target,
                        )
                        .await
                        .context(format!(
                            "Failed to apply OIDC application: {} for project: {} in scope: {}",
                            resource_application.name, project_name, resource_scope
                        ))?,
                    resource_types::RawZitadelApplicationMethod::Api(api_config) => zitadel_client
                        .apply_api_application(
                            resource_scope,
                            &project_org_id,
                            &project_id,
                            &resource_application.name,
                            api_config,
                            &resource_application.client_data_target,
                        )
                        .await
                        .context(format!(
                            "Failed to apply API application: {} for project: {} in scope: {}",
                            resource_application.name, project_name, resource_scope
                        ))?,
                };
            }
        }
    };

    Ok(())
}

#[derive(thiserror::Error, Debug)]
pub enum ZitadelResourceRawError {
    #[error("Org not found: {0}")]
    OrgNotFound(String),
    #[error(transparent)]
    AnyhowError(#[from] anyhow::Error),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_zitadel_project_name() {
        assert_eq!(
            get_zitadel_project_name("mows-core-auth", "argocd-oidc"),
            "zrc-mows-core-auth-argocd-oidc"
        );
    }

    #[test]
    fn test_get_zitadel_project_name_default_scope() {
        assert_eq!(
            get_zitadel_project_name("default", "my-app"),
            "zrc-default-my-app"
        );
    }

    #[test]
    fn test_get_zitadel_project_name_docker_scope() {
        assert_eq!(
            get_zitadel_project_name("docker", "web-service"),
            "zrc-docker-web-service"
        );
    }

    #[test]
    fn test_zitadel_resource_raw_error_display() {
        let err = ZitadelResourceRawError::OrgNotFound("my-org".to_string());
        assert_eq!(format!("{}", err), "Org not found: my-org");
    }

    #[test]
    fn test_zitadel_resource_raw_error_from_anyhow() {
        let anyhow_err = anyhow::anyhow!("underlying cause");
        let err: ZitadelResourceRawError = anyhow_err.into();
        assert!(format!("{}", err).contains("underlying cause"));
    }
}
