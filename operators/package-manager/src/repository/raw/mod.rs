use std::collections::HashMap;

use super::RepositoryPaths;
use crate::{
    rendered_document::RenderedDocument,
    types::{ManifestSource, RawManifestSpec},
    utils::get_all_file_paths_recursive,
};
use anyhow::Context;
use helm::HelmRepoError;
use mows_common::templating::{
    functions::{serde_json_hashmap_to_gtmpl_hashmap, TEMPLATE_FUNCTIONS},
    gtmpl::{self, Context as GtmplContext, Template, Value as GtmplValue},
    gtmpl_derive::Gtmpl,
};
use serde_yaml_ng::Value;
mod files;
mod helm;

impl RawManifestSpec {
    pub async fn render(
        &self,
        repo_paths: &RepositoryPaths,
        namespace: &str,
    ) -> Result<Vec<RenderedDocument>, RawSpecError> {
        let mut rendered_documents: Vec<RenderedDocument> = Vec::new();

        for (source_name, source) in &self.sources {
            match source {
                ManifestSource::Helm(helm_repo) => {
                    let helm_rendered_documents =
                        helm_repo.handle(repo_paths, namespace, source_name).await?;
                    // append all
                    rendered_documents.extend(helm_rendered_documents);
                }
                ManifestSource::Files(files) => {
                    let returned_files = files.handle(repo_paths, source_name).await?;
                    rendered_documents.extend(returned_files);
                }
            }
        }

        Ok(rendered_documents)
    }

    fn transform(value: &mut Value, namespace: &str, force_namespace: bool) {
        if !force_namespace {
            return;
        }

        // TODO when force_namespace is true, we also need to remove the resource kind namespace completely

        match value {
            Value::Mapping(ref mut map) => {
                match map.get_mut(&serde_yaml_ng::Value::String("metadata".to_string())) {
                    Some(metadata) => {
                        if let Value::Mapping(ref mut metadata_map) = metadata {
                            metadata_map.insert(
                                serde_yaml_ng::Value::String("namespace".to_string()),
                                serde_yaml_ng::Value::String(namespace.to_string()),
                            );
                        }
                    }
                    None => {
                        let metadata = serde_yaml_ng::Value::Mapping(serde_yaml_ng::Mapping::new());
                        map.insert(
                            serde_yaml_ng::Value::String("metadata".to_string()),
                            metadata,
                        );

                        if let Value::Mapping(ref mut metadata_map) = map
                            .get_mut(&serde_yaml_ng::Value::String("metadata".to_string()))
                            .unwrap()
                        {
                            metadata_map.insert(
                                serde_yaml_ng::Value::String("namespace".to_string()),
                                serde_yaml_ng::Value::String(namespace.to_string()),
                            );
                        }
                    }
                }
            }
            _ => {}
        }
    }

    pub async fn replace_app_config(
        &self,
        repo_paths: &RepositoryPaths,
        app_config: HashMap<String, serde_json::Value>,
    ) -> Result<(), RawSpecError> {
        // replace cluster variables in all files recursively
        let file_paths = get_all_file_paths_recursive(&repo_paths.mows_repo_source_path).await;

        let mut template_creator = Template::default();
        template_creator.add_funcs(&TEMPLATE_FUNCTIONS);

        #[derive(Gtmpl)]
        struct LocalContext {
            config: HashMap<String, GtmplValue>,
        }

        let context = GtmplContext::from(LocalContext {
            config: serde_json_hashmap_to_gtmpl_hashmap(app_config),
        });

        let temp_token_left = "{lt.pm.reserved.mows.cloud";
        let temp_token_right = "rt.pm.reserved.mows.cloud}";

        for file_path in file_paths {
            let original_file_content = tokio::fs::read_to_string(&file_path)
                .await?
                .replace("{{", &temp_token_left)
                .replace("}}", &temp_token_right)
                .replace("{§", "{{")
                .replace("§}", "}}");

            template_creator
                .parse(&original_file_content)
                .context(format!(
                    "Error parsing template: {} with content:\n {}",
                    file_path.to_str().unwrap_or(""),
                    &original_file_content
                ))?;

            let rendered_content = template_creator.render(&context)?;

            tokio::fs::write(
                &file_path,
                rendered_content
                    .replace(temp_token_left, "{{")
                    .replace(temp_token_right, "}}"),
            )
            .await?;
        }

        Ok(())
    }
}

#[derive(Debug, thiserror::Error)]
pub enum RawSpecError {
    #[error("Error rendering HelmRepo: {0}")]
    HelmRepoError(#[from] HelmRepoError),
    #[error("Error handling file spec: {0}")]
    FilesError(#[from] files::FilesSpecError),
    #[error("Error reading file: {0}")]
    ReadFileError(#[from] tokio::io::Error),
    #[error(transparent)]
    AnyhowError(#[from] anyhow::Error),
    #[error("Error parsing file: {0}")]
    ParsingError(#[from] serde_yaml_ng::Error),
    #[error("Error rendering template: {0}")]
    TemplateExecError(#[from] gtmpl::error::ExecError),
    #[error("Error parsing template: {0}")]
    ParseTemplateError(#[from] gtmpl::error::ParseError),
}
