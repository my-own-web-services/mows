use super::RepositoryPaths;
use crate::{dev::get_fake_app_config, types::RawSpec, utils::get_all_file_paths_recursive};
use anyhow::Context;
use helm::HelmRepoError;
use serde::Deserialize;
use serde_yaml::Value;
use std::collections::HashMap;

use mows_common::templating::{
    functions::{serde_json_hashmap_to_gtmpl_hashmap, TEMPLATE_FUNCTIONS},
    gtmpl::{self, Context as GtmplContext, Template, Value as GtmplValue},
    gtmpl_derive::Gtmpl,
};

mod helm;

impl RawSpec {
    pub async fn render(
        &self,
        repo_paths: &RepositoryPaths,
        namespace: &str,
    ) -> Result<HashMap<String, String>, RawSpecError> {
        match self {
            RawSpec::HelmRepos(helm_repos) => {
                for helm_repo in helm_repos {
                    helm_repo.fetch(repo_paths).await?;
                }
            }
        }

        let app_config = get_fake_app_config().await;

        self.replace_app_config(repo_paths, app_config).await?;

        match self {
            RawSpec::HelmRepos(helm_repos) => {
                for helm_repo in helm_repos {
                    helm_repo.render(repo_paths, namespace).await?;
                }
            }
        }

        // read all files from output directory

        let mut result_files = HashMap::new();

        let file_paths = get_all_file_paths_recursive(&repo_paths.output_path).await;

        for file_path in file_paths {
            let input_file_string = tokio::fs::read_to_string(&file_path).await?;

            let mut output_file_docs = Vec::new();

            for single_document_deserializer in
                serde_yaml::Deserializer::from_str(&input_file_string)
            {
                let mut value: Value = Value::deserialize(single_document_deserializer).context(
                    format!("Error parsing file: {}", file_path.to_str().unwrap_or("")),
                )?;

                let force_namespace = false;

                Self::transform(&mut value, namespace, force_namespace);

                let single_document_content_string = serde_yaml::to_string(&value)?;

                output_file_docs.push(single_document_content_string);
            }

            let output_path_string = repo_paths
                .output_path
                .to_str()
                .ok_or("Invalid file path")
                .map_err(|e| RawSpecError::AnyhowError(anyhow::anyhow!(e)))?;

            result_files.insert(
                file_path
                    .to_str()
                    .ok_or("Invalid file path")
                    .map_err(|e| RawSpecError::AnyhowError(anyhow::anyhow!(e)))?
                    .to_string()
                    .replace(output_path_string, ""),
                output_file_docs.join("---\n"),
            );
        }

        Ok(result_files)
    }

    fn transform(value: &mut Value, namespace: &str, force_namespace: bool) {
        if !force_namespace {
            return;
        }

        // TODO when force_namespace is true, we also need to remove the resource kind namespace completely

        match value {
            Value::Mapping(ref mut map) => {
                match map.get_mut(&serde_yaml::Value::String("metadata".to_string())) {
                    Some(metadata) => {
                        if let Value::Mapping(ref mut metadata_map) = metadata {
                            metadata_map.insert(
                                serde_yaml::Value::String("namespace".to_string()),
                                serde_yaml::Value::String(namespace.to_string()),
                            );
                        }
                    }
                    None => {
                        let metadata = serde_yaml::Value::Mapping(serde_yaml::Mapping::new());
                        map.insert(serde_yaml::Value::String("metadata".to_string()), metadata);

                        if let Value::Mapping(ref mut metadata_map) = map
                            .get_mut(&serde_yaml::Value::String("metadata".to_string()))
                            .unwrap()
                        {
                            metadata_map.insert(
                                serde_yaml::Value::String("namespace".to_string()),
                                serde_yaml::Value::String(namespace.to_string()),
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
        let file_paths = get_all_file_paths_recursive(&repo_paths.source_path).await;

        let mut template_creator = Template::default();
        template_creator.add_funcs(&TEMPLATE_FUNCTIONS);

        #[derive(Gtmpl)]
        struct LocalContext {
            config: HashMap<String, GtmplValue>,
        }

        let context = GtmplContext::from(LocalContext {
            config: serde_json_hashmap_to_gtmpl_hashmap(app_config),
        });

        let temp_token_left = "{t";
        let temp_token_right = "t}";

        for file_path in file_paths {
            let original_file_content = tokio::fs::read_to_string(&file_path)
                .await?
                .replace("{{", &temp_token_left)
                .replace("}}", &temp_token_right)
                .replace("{§", "{{")
                .replace("§}", "}}");

            println!("file_content: {}", &original_file_content);

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
    #[error("Error reading file: {0}")]
    ReadFileError(#[from] tokio::io::Error),
    #[error(transparent)]
    AnyhowError(#[from] anyhow::Error),
    #[error("Error parsing file: {0}")]
    ParsingError(#[from] serde_yaml::Error),
    #[error("Error rendering template: {0}")]
    TemplateExecError(#[from] gtmpl::error::ExecError),
    #[error("Error parsing template: {0}")]
    ParseTemplateError(#[from] gtmpl::error::ParseError),
}
