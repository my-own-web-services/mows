use std::collections::HashMap;

use utoipa::openapi::{path::Operation, PathItem, Responses};

use crate::openapi_client_generator::{
    generators::rust::schema::ref_or_schema_to_rust_type, ClientGeneratorError,
};

#[derive(Debug, Clone, PartialEq, Eq)]
struct FunctionArgument {
    name: String,
    optional: bool,
    rust_type: String,
    parameter_in: ParameterIn,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum ParameterIn {
    Path,
    Query,
    RequestBody,
}

fn function_arguments_to_string(function_arguments: &Vec<FunctionArgument>) -> String {
    function_arguments
        .iter()
        .map(|arg| format!("{}: {}", arg.name, arg.rust_type))
        .collect::<Vec<_>>()
        .join(", ")
}

fn function_arguments_optional_conversion(function_arguments: &Vec<FunctionArgument>) -> String {
    function_arguments
        .iter()
        .filter(|arg| arg.optional)
        .map(|arg| format!(r#"let {} = OptionAsNull({});"#, arg.name, arg.name))
        .collect::<Vec<_>>()
        .join("\n        ")
}

fn append_query_parameters(function_arguments: &Vec<FunctionArgument>) -> String {
    let query_params: Vec<String> = function_arguments
        .iter()
        .filter(|arg| arg.parameter_in == ParameterIn::Query)
        .map(|arg| format!(r#".append_pair("{}", &{}.to_string())"#, arg.name, arg.name))
        .collect();

    if query_params.is_empty() {
        "".to_string()
    } else {
        format!(
            ".query_pairs_mut(){}.finish().clone()",
            query_params.join("")
        )
    }
}

fn append_body(function_arguments: &Vec<FunctionArgument>) -> String {
    if let Some(body_arg) = function_arguments
        .iter()
        .find(|arg| arg.parameter_in == ParameterIn::RequestBody)
    {
        format!(r#".json(&{})"#, body_arg.name)
    } else {
        "".to_string()
    }
}

fn get_result_type(responses: &Responses) -> Result<String, ClientGeneratorError> {
    if let Some((_, response_or_ref)) = responses
        .responses
        .iter()
        .find(|(status, _)| status.starts_with("20"))
    {
        match response_or_ref {
            utoipa::openapi::RefOr::T(response) => {
                for (content_type, content) in &response.content {
                    if content_type == "application/json" {
                        if let Some(schema) = &content.schema {
                            return Ok(ref_or_schema_to_rust_type(
                                &mut HashMap::new(),
                                None,
                                schema,
                            )?
                            .replace("_", ""));
                        }
                    }
                }
            }
            _ => {
                return Err(ClientGeneratorError::GenerationError(
                    "Response schema is a reference, which is not supported yet".to_string(),
                ));
            }
        }
    }
    Ok("()".to_string())
}

pub fn generate_client_function(
    path: &str,
    method: &str,
    operation: &Operation,
) -> Result<String, ClientGeneratorError> {
    let function_arguments: Vec<FunctionArgument> = parse_function_arguments(&operation)?;
    let result_type = get_result_type(&operation.responses)?;

    let function_top_line = format!(
        "pub async fn {}(&self{} {}) -> Result<{}, ApiClientError> {{",
        operation
            .operation_id
            .clone()
            .ok_or(ClientGeneratorError::MissingOperationId)?,
        if function_arguments.is_empty() {
            "".to_string()
        } else {
            ",".to_string()
        },
        function_arguments_to_string(&function_arguments),
        result_type
    );

    let optional_path_conversion = function_arguments_optional_conversion(&function_arguments);

    let url_section = format!(
        r#"let full_url = format!("{{}}{}", self.base_url);
        let full_url = Url::parse(&full_url).unwrap(){};"#,
        path,
        append_query_parameters(&function_arguments),
    );

    let request_section = format!(
        r#"
        let response = self.client.{method}(full_url).headers(self.add_auth_headers()?){}.send().await?.json().await?;"#,
        append_body(&function_arguments)
    );

    Ok(format!(
        r#"{function_top_line}
        {optional_path_conversion}
        {url_section}
        {request_section}
        Ok(response)
    }}"#
    ))
}

fn parse_function_arguments(
    operation: &Operation,
) -> Result<Vec<FunctionArgument>, ClientGeneratorError> {
    let mut parsed_arguments = Vec::new();

    // First, parse path parameters
    if let Some(parameters) = &operation.parameters {
        for param in parameters {
            if param.parameter_in == utoipa::openapi::path::ParameterIn::Path {
                let rust_type = ref_or_schema_to_rust_type(
                    &mut HashMap::new(),
                    Some(param.name.clone()),
                    &param.schema.clone().unwrap(),
                )?;
                parsed_arguments.push(FunctionArgument {
                    name: param.name.clone(),
                    optional: rust_type.contains("Option<"),
                    rust_type,
                    parameter_in: ParameterIn::Path,
                });
            }
        }
    }

    // Then, parse query parameters
    if let Some(query_params) = &operation.parameters {
        for param in query_params {
            if param.parameter_in == utoipa::openapi::path::ParameterIn::Query {
                let rust_type = ref_or_schema_to_rust_type(
                    &mut HashMap::new(),
                    Some(param.name.clone()),
                    &param.schema.clone().unwrap(),
                )?;
                parsed_arguments.push(FunctionArgument {
                    name: param.name.clone(),
                    optional: rust_type.contains("Option<"),
                    rust_type,
                    parameter_in: ParameterIn::Query,
                });
            }
        }
    }

    // Handle request body if present
    if let Some(request_body) = &operation.request_body {
        for (media_type, media_type_content) in &request_body.content {
            if media_type == "application/json" {
                if let Some(schema) = &media_type_content.schema {
                    let rust_type = ref_or_schema_to_rust_type(&mut HashMap::new(), None, schema)?;
                    parsed_arguments.push(FunctionArgument {
                        name: "request_body".to_string(),
                        optional: false,
                        rust_type,
                        parameter_in: ParameterIn::RequestBody,
                    });
                }
            }
        }
    }

    Ok(parsed_arguments)
}

pub fn get_operations(
    path_item: &PathItem,
) -> Result<HashMap<String, Operation>, ClientGeneratorError> {
    let mut operations = HashMap::new();
    if let Some(get) = &path_item.get {
        operations.insert("get".to_string(), get.clone());
    }
    if let Some(post) = &path_item.post {
        operations.insert("post".to_string(), post.clone());
    }
    if let Some(put) = &path_item.put {
        operations.insert("put".to_string(), put.clone());
    }
    if let Some(delete) = &path_item.delete {
        operations.insert("delete".to_string(), delete.clone());
    }
    if let Some(patch) = &path_item.patch {
        operations.insert("patch".to_string(), patch.clone());
    }
    if let Some(head) = &path_item.head {
        operations.insert("head".to_string(), head.clone());
    }
    if let Some(options) = &path_item.options {
        operations.insert("options".to_string(), options.clone());
    }
    if let Some(trace) = &path_item.trace {
        operations.insert("trace".to_string(), trace.clone());
    }

    Ok(operations)
}
