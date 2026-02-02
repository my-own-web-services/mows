use std::collections::HashMap;

use crate::resource_types::RawZitadelResource;
use serde_json::Value;

#[derive(Debug, thiserror::Error)]
pub enum LabelParseError {
    #[error("Conflicting path in labels: {0}")]
    ConflictingPath(String),

    #[error("Failed to deserialize labels into resource: {0}")]
    DeserializationError(String),

    #[error("No labels found with prefix: {0}")]
    NoLabelsFound(String),
}

/// Parse Docker container labels with the given prefix into a `RawZitadelResource`.
///
/// Labels use Traefik-style flat dot-notation:
/// - `zrc.resource.project.projectRoleAssertion=true`
/// - `zrc.resource.project.roles.0.key=admin`
/// - Arrays use numeric indices: `.0`, `.1`, etc.
/// - Enums use their variant name as a key: `.method.oidc.redirectUris.0=...`
/// - HashMaps use their key name: `.actions.groupsClaim.script=...`
///
/// Note: Duplicate label keys are impossible since the input is a `HashMap<String, String>`,
/// which enforces key uniqueness. Docker itself also deduplicates labels by key.
pub fn parse_labels(
    labels: &HashMap<String, String>,
    prefix: &str,
) -> Result<RawZitadelResource, LabelParseError> {
    let full_prefix = format!("{}.", prefix);
    let json_value = labels_to_json_value(labels, &full_prefix)?;

    serde_json::from_value(json_value)
        .map_err(|e| LabelParseError::DeserializationError(e.to_string()))
}

/// Convert flat dot-notation labels into a nested JSON Value tree.
///
/// Only labels starting with the given prefix are included.
/// The prefix is stripped before building the tree.
fn labels_to_json_value(
    labels: &HashMap<String, String>,
    prefix: &str,
) -> Result<Value, LabelParseError> {
    let mut root = Value::Object(serde_json::Map::new());

    let mut relevant: Vec<(&str, &str)> = labels
        .iter()
        .filter_map(|(k, v)| k.strip_prefix(prefix).map(|rest| (rest, v.as_str())))
        .collect();

    if relevant.is_empty() {
        return Err(LabelParseError::NoLabelsFound(prefix.to_string()));
    }

    // Sort for deterministic processing
    relevant.sort_by_key(|(k, _)| *k);

    for (path, value) in relevant {
        insert_at_path(&mut root, path, value)?;
    }

    // Convert numeric-keyed objects to arrays
    convert_numeric_objects_to_arrays(&mut root);

    Ok(root)
}

/// Insert a value at a dot-separated path in the JSON tree.
fn insert_at_path(root: &mut Value, path: &str, value: &str) -> Result<(), LabelParseError> {
    let segments: Vec<&str> = path.split('.').collect();
    let mut current = root;

    for (i, segment) in segments.iter().enumerate() {
        if i == segments.len() - 1 {
            // Leaf: insert the value
            match current {
                Value::Object(map) => {
                    let parsed = parse_scalar(value);
                    map.insert((*segment).to_string(), parsed);
                }
                _ => return Err(LabelParseError::ConflictingPath(path.to_string())),
            }
        } else {
            // Intermediate: ensure an object exists
            match current {
                Value::Object(map) => {
                    current = map
                        .entry((*segment).to_string())
                        .or_insert_with(|| Value::Object(serde_json::Map::new()));
                }
                _ => return Err(LabelParseError::ConflictingPath(path.to_string())),
            }
        }
    }
    Ok(())
}

/// Parse a scalar string into the most appropriate JSON Value type.
fn parse_scalar(value: &str) -> Value {
    // Booleans
    if value == "true" {
        return Value::Bool(true);
    }
    if value == "false" {
        return Value::Bool(false);
    }
    // Integers
    if let Ok(n) = value.parse::<i64>() {
        return Value::Number(n.into());
    }
    // String (don't try float parsing to avoid accidental conversion)
    Value::String(value.to_string())
}

/// Recursively convert objects with consecutive numeric keys (0, 1, 2, ...) into JSON arrays.
fn convert_numeric_objects_to_arrays(value: &mut Value) {
    match value {
        Value::Object(map) => {
            // First recurse into children
            for v in map.values_mut() {
                convert_numeric_objects_to_arrays(v);
            }

            // Check if all keys are consecutive integers starting from 0
            if !map.is_empty() {
                let mut indices: Vec<usize> = map
                    .keys()
                    .filter_map(|k| k.parse::<usize>().ok())
                    .collect();
                indices.sort();

                let is_array_like = indices.len() == map.len()
                    && indices
                        .iter()
                        .enumerate()
                        .all(|(i, &idx)| i == idx);

                if is_array_like {
                    let mut entries: Vec<(usize, Value)> = map
                        .iter()
                        .filter_map(|(k, v)| k.parse::<usize>().ok().map(|i| (i, v.clone())))
                        .collect();
                    entries.sort_by_key(|(i, _)| *i);
                    *value = Value::Array(entries.into_iter().map(|(_, v)| v).collect());
                }
            }
        }
        Value::Array(arr) => {
            for v in arr.iter_mut() {
                convert_numeric_objects_to_arrays(v);
            }
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::resource_types::{
        ApiAuthMethodType, OidcAppType, OidcAuthMethodType, OidcGrantType, OidcResponseType,
        OidcTokenType, RawZitadelResourceSelector,
    };

    fn make_labels(pairs: &[(&str, &str)]) -> HashMap<String, String> {
        pairs
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_string()))
            .collect()
    }

    #[test]
    fn test_simple_project_with_roles() {
        let labels = make_labels(&[
            ("zrc.resource.project.projectRoleAssertion", "true"),
            ("zrc.resource.project.projectRoleCheck", "false"),
            ("zrc.resource.project.roles.0.key", "admin"),
            ("zrc.resource.project.roles.0.displayName", "Administrators"),
            ("zrc.resource.project.roles.0.group", "admin_group"),
            ("zrc.resource.project.adminRoles.0", "admin"),
            ("zrc.resource.project.applications.0.name", "test-app"),
            (
                "zrc.resource.project.applications.0.clientDataTarget.file.path",
                "/tmp/creds.json",
            ),
            (
                "zrc.resource.project.applications.0.method.api.authenticationMethod",
                "basic",
            ),
        ]);

        let resource = parse_labels(&labels, "zrc").unwrap();
        match &resource.resource {
            RawZitadelResourceSelector::Project(project) => {
                assert!(project.project_role_assertion);
                assert!(!project.project_role_check);
                assert_eq!(project.roles.len(), 1);
                assert_eq!(project.roles[0].key, "admin");
                assert_eq!(project.roles[0].display_name, "Administrators");
                assert_eq!(project.roles[0].group, "admin_group");
                assert_eq!(project.admin_roles, vec!["admin"]);
                assert_eq!(project.applications.len(), 1);
                assert_eq!(project.applications[0].name, "test-app");
            }
        }
    }

    #[test]
    fn test_multiple_roles_and_admin_roles() {
        let labels = make_labels(&[
            ("zrc.resource.project.projectRoleAssertion", "true"),
            ("zrc.resource.project.projectRoleCheck", "true"),
            ("zrc.resource.project.roles.0.key", "admin"),
            ("zrc.resource.project.roles.0.displayName", "Admins"),
            ("zrc.resource.project.roles.0.group", "admin"),
            ("zrc.resource.project.roles.1.key", "user"),
            ("zrc.resource.project.roles.1.displayName", "Users"),
            ("zrc.resource.project.roles.1.group", "user"),
            ("zrc.resource.project.adminRoles.0", "admin"),
            ("zrc.resource.project.adminRoles.1", "user"),
            ("zrc.resource.project.applications.0.name", "my-app"),
            (
                "zrc.resource.project.applications.0.clientDataTarget.file.path",
                "/data/creds.json",
            ),
            (
                "zrc.resource.project.applications.0.method.api.authenticationMethod",
                "basic",
            ),
        ]);

        let resource = parse_labels(&labels, "zrc").unwrap();
        match &resource.resource {
            RawZitadelResourceSelector::Project(project) => {
                assert_eq!(project.roles.len(), 2);
                assert_eq!(project.roles[0].key, "admin");
                assert_eq!(project.roles[1].key, "user");
                assert_eq!(project.admin_roles, vec!["admin", "user"]);
            }
        }
    }

    #[test]
    fn test_oidc_application() {
        let labels = make_labels(&[
            ("zrc.resource.project.projectRoleAssertion", "true"),
            ("zrc.resource.project.projectRoleCheck", "true"),
            ("zrc.resource.project.roles.0.key", "admin"),
            ("zrc.resource.project.roles.0.displayName", "Admins"),
            ("zrc.resource.project.roles.0.group", "admin"),
            ("zrc.resource.project.adminRoles.0", "admin"),
            ("zrc.resource.project.applications.0.name", "my-oidc-app"),
            (
                "zrc.resource.project.applications.0.clientDataTarget.file.path",
                "/data/creds.json",
            ),
            (
                "zrc.resource.project.applications.0.method.oidc.redirectUris.0",
                "https://example.com/callback",
            ),
            (
                "zrc.resource.project.applications.0.method.oidc.responseTypes.0",
                "code",
            ),
            (
                "zrc.resource.project.applications.0.method.oidc.grantTypes.0",
                "authorizationCode",
            ),
            (
                "zrc.resource.project.applications.0.method.oidc.appType",
                "web",
            ),
            (
                "zrc.resource.project.applications.0.method.oidc.authenticationMethod",
                "basic",
            ),
            (
                "zrc.resource.project.applications.0.method.oidc.accessTokenType",
                "bearer",
            ),
            (
                "zrc.resource.project.applications.0.method.oidc.idTokenRoleAssertion",
                "true",
            ),
            (
                "zrc.resource.project.applications.0.method.oidc.idTokenUserinfoAssertion",
                "true",
            ),
        ]);

        let resource = parse_labels(&labels, "zrc").unwrap();
        match &resource.resource {
            RawZitadelResourceSelector::Project(project) => {
                assert_eq!(project.applications.len(), 1);
                let app = &project.applications[0];
                assert_eq!(app.name, "my-oidc-app");
                match &app.method {
                    crate::resource_types::RawZitadelApplicationMethod::Oidc(oidc) => {
                        assert_eq!(oidc.redirect_uris, vec!["https://example.com/callback"]);
                        assert!(matches!(oidc.response_types[0], OidcResponseType::Code));
                        assert!(matches!(
                            oidc.grant_types[0],
                            OidcGrantType::AuthorizationCode
                        ));
                        assert!(matches!(oidc.app_type, OidcAppType::Web));
                        assert!(matches!(
                            oidc.authentication_method,
                            OidcAuthMethodType::Basic
                        ));
                        assert!(matches!(oidc.access_token_type, OidcTokenType::Bearer));
                        assert_eq!(oidc.id_token_role_assertion, Some(true));
                        assert_eq!(oidc.id_token_userinfo_assertion, Some(true));
                    }
                    _ => panic!("Expected OIDC application method"),
                }
            }
        }
    }

    #[test]
    fn test_api_application() {
        let labels = make_labels(&[
            ("zrc.resource.project.projectRoleAssertion", "false"),
            ("zrc.resource.project.projectRoleCheck", "false"),
            ("zrc.resource.project.roles.0.key", "svc"),
            ("zrc.resource.project.roles.0.displayName", "Service"),
            ("zrc.resource.project.roles.0.group", "svc"),
            ("zrc.resource.project.adminRoles.0", "svc"),
            ("zrc.resource.project.applications.0.name", "my-api"),
            (
                "zrc.resource.project.applications.0.clientDataTarget.file.path",
                "/data/api-creds.json",
            ),
            (
                "zrc.resource.project.applications.0.method.api.authenticationMethod",
                "privateKeyJwt",
            ),
        ]);

        let resource = parse_labels(&labels, "zrc").unwrap();
        match &resource.resource {
            RawZitadelResourceSelector::Project(project) => {
                match &project.applications[0].method {
                    crate::resource_types::RawZitadelApplicationMethod::Api(api) => {
                        assert!(matches!(
                            api.authentication_method,
                            ApiAuthMethodType::PrivateKeyJwt
                        ));
                    }
                    _ => panic!("Expected API application method"),
                }
            }
        }
    }

    #[test]
    fn test_hashmap_actions() {
        let labels = make_labels(&[
            ("zrc.resource.project.projectRoleAssertion", "true"),
            ("zrc.resource.project.projectRoleCheck", "true"),
            ("zrc.resource.project.roles.0.key", "admin"),
            ("zrc.resource.project.roles.0.displayName", "Admins"),
            ("zrc.resource.project.roles.0.group", "admin"),
            ("zrc.resource.project.adminRoles.0", "admin"),
            ("zrc.resource.project.applications.0.name", "app"),
            (
                "zrc.resource.project.applications.0.clientDataTarget.file.path",
                "/tmp/c.json",
            ),
            (
                "zrc.resource.project.applications.0.method.api.authenticationMethod",
                "basic",
            ),
            (
                "zrc.resource.project.actionFlow.actions.groupsClaim.script",
                "function groupsClaim(ctx, api) { api.v1.claims.setClaim('groups', []); }",
            ),
            (
                "zrc.resource.project.actionFlow.actions.groupsClaim.timeoutSeconds",
                "10",
            ),
            (
                "zrc.resource.project.actionFlow.actions.groupsClaim.allowedToFail",
                "true",
            ),
            (
                "zrc.resource.project.actionFlow.flow.complementToken.preUserinfoCreation.0",
                "groupsClaim",
            ),
            (
                "zrc.resource.project.actionFlow.flow.complementToken.preAccessTokenCreation.0",
                "groupsClaim",
            ),
        ]);

        let resource = parse_labels(&labels, "zrc").unwrap();
        match &resource.resource {
            RawZitadelResourceSelector::Project(project) => {
                let action_flow = project.action_flow.as_ref().unwrap();
                assert!(action_flow.actions.contains_key("groupsClaim"));
                let action = &action_flow.actions["groupsClaim"];
                assert!(action.script.contains("groupsClaim"));
                assert_eq!(action.timeout_seconds, Some(10));
                assert_eq!(action.allowed_to_fail, Some(true));

                let complement = action_flow.flow.complement_token.as_ref().unwrap();
                assert_eq!(
                    complement.pre_userinfo_creation,
                    Some(vec!["groupsClaim".to_string()])
                );
                assert_eq!(
                    complement.pre_access_token_creation,
                    Some(vec!["groupsClaim".to_string()])
                );
            }
        }
    }

    #[test]
    fn test_vault_client_data_target() {
        let labels = make_labels(&[
            ("zrc.resource.project.projectRoleAssertion", "true"),
            ("zrc.resource.project.projectRoleCheck", "true"),
            ("zrc.resource.project.roles.0.key", "admin"),
            ("zrc.resource.project.roles.0.displayName", "Admins"),
            ("zrc.resource.project.roles.0.group", "admin"),
            ("zrc.resource.project.adminRoles.0", "admin"),
            ("zrc.resource.project.applications.0.name", "app"),
            (
                "zrc.resource.project.applications.0.clientDataTarget.vault.secretEngineName",
                "my-engine",
            ),
            (
                "zrc.resource.project.applications.0.clientDataTarget.vault.secretEngineSubPath",
                "oidc",
            ),
            (
                "zrc.resource.project.applications.0.clientDataTarget.vault.kubernetesAuthEngineName",
                "k8s-auth",
            ),
            (
                "zrc.resource.project.applications.0.method.api.authenticationMethod",
                "basic",
            ),
        ]);

        let resource = parse_labels(&labels, "zrc").unwrap();
        match &resource.resource {
            RawZitadelResourceSelector::Project(project) => {
                match &project.applications[0].client_data_target {
                    crate::resource_types::RawZitadelApplicationClientDataTarget::Vault(vault) => {
                        assert_eq!(vault.secret_engine_name, "my-engine");
                        assert_eq!(vault.secret_engine_sub_path, "oidc");
                        assert_eq!(vault.kubernetes_auth_engine_name, "k8s-auth");
                    }
                    _ => panic!("Expected Vault client data target"),
                }
            }
        }
    }

    #[test]
    fn test_no_labels_with_prefix() {
        let labels = make_labels(&[("other.key", "value")]);

        let result = parse_labels(&labels, "zrc");
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), LabelParseError::NoLabelsFound(_)));
    }

    #[test]
    fn test_invalid_deserialization() {
        let labels = make_labels(&[("zrc.resource.project.projectRoleAssertion", "true")]);

        // Missing required fields should fail deserialization
        let result = parse_labels(&labels, "zrc");
        assert!(result.is_err());
        assert!(matches!(
            result.unwrap_err(),
            LabelParseError::DeserializationError(_)
        ));
    }

    #[test]
    fn test_labels_ignored_without_prefix() {
        let labels = make_labels(&[
            ("zrc.resource.project.projectRoleAssertion", "true"),
            ("zrc.resource.project.projectRoleCheck", "true"),
            ("zrc.resource.project.roles.0.key", "admin"),
            ("zrc.resource.project.roles.0.displayName", "Admins"),
            ("zrc.resource.project.roles.0.group", "admin"),
            ("zrc.resource.project.adminRoles.0", "admin"),
            ("zrc.resource.project.applications.0.name", "app"),
            (
                "zrc.resource.project.applications.0.clientDataTarget.file.path",
                "/tmp/c.json",
            ),
            (
                "zrc.resource.project.applications.0.method.api.authenticationMethod",
                "basic",
            ),
            // These should be ignored
            ("some.other.label", "ignored"),
            ("traefik.http.routers.myrouter.rule", "Host(`example.com`)"),
        ]);

        let resource = parse_labels(&labels, "zrc");
        assert!(resource.is_ok());
    }

    #[test]
    fn test_parse_scalar_types() {
        assert_eq!(parse_scalar("true"), Value::Bool(true));
        assert_eq!(parse_scalar("false"), Value::Bool(false));
        assert_eq!(parse_scalar("42"), Value::Number(42.into()));
        assert_eq!(parse_scalar("0"), Value::Number(0.into()));
        assert_eq!(
            parse_scalar("hello"),
            Value::String("hello".to_string())
        );
        assert_eq!(
            parse_scalar("https://example.com"),
            Value::String("https://example.com".to_string())
        );
    }

    #[test]
    fn test_convert_numeric_objects_to_arrays() {
        let mut val = serde_json::json!({
            "0": "a",
            "1": "b",
            "2": "c"
        });
        convert_numeric_objects_to_arrays(&mut val);
        assert_eq!(val, serde_json::json!(["a", "b", "c"]));
    }

    #[test]
    fn test_mixed_keys_not_converted() {
        let mut val = serde_json::json!({
            "groupsClaim": {"script": "code"},
            "otherAction": {"script": "code2"}
        });
        let expected = val.clone();
        convert_numeric_objects_to_arrays(&mut val);
        assert_eq!(val, expected);
    }

    #[test]
    fn test_parse_scalar_negative_numbers() {
        assert_eq!(parse_scalar("-1"), Value::Number((-1).into()));
        assert_eq!(parse_scalar("-9999"), Value::Number((-9999).into()));
    }

    #[test]
    fn test_parse_scalar_large_integers() {
        assert_eq!(
            parse_scalar("9999999999"),
            Value::Number(9999999999i64.into())
        );
    }

    #[test]
    fn test_parse_scalar_float_stays_string() {
        // Floats should not be parsed to avoid accidental conversion
        assert_eq!(
            parse_scalar("3.14"),
            Value::String("3.14".to_string())
        );
    }

    #[test]
    fn test_parse_scalar_empty_string() {
        assert_eq!(parse_scalar(""), Value::String("".to_string()));
    }

    #[test]
    fn test_sparse_indices_not_converted_to_array() {
        // Non-contiguous indices (0, 2 but no 1) should stay as object
        let mut val = serde_json::json!({
            "0": "a",
            "2": "c"
        });
        let expected = val.clone();
        convert_numeric_objects_to_arrays(&mut val);
        assert_eq!(val, expected);
    }

    #[test]
    fn test_single_element_array() {
        let mut val = serde_json::json!({
            "0": "only"
        });
        convert_numeric_objects_to_arrays(&mut val);
        assert_eq!(val, serde_json::json!(["only"]));
    }

    #[test]
    fn test_conflicting_path_scalar_then_object() {
        let labels = make_labels(&[
            ("zrc.resource.project.projectRoleAssertion", "true"),
            ("zrc.resource.project.projectRoleAssertion.nested", "value"),
        ]);

        let result = labels_to_json_value(&labels, "zrc.");
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), LabelParseError::ConflictingPath(_)));
    }

    #[test]
    fn test_custom_prefix() {
        let labels = make_labels(&[
            ("myprefix.resource.project.projectRoleAssertion", "true"),
            ("myprefix.resource.project.projectRoleCheck", "false"),
            ("myprefix.resource.project.roles.0.key", "admin"),
            ("myprefix.resource.project.roles.0.displayName", "Admins"),
            ("myprefix.resource.project.roles.0.group", "admin"),
            ("myprefix.resource.project.adminRoles.0", "admin"),
            ("myprefix.resource.project.applications.0.name", "app"),
            (
                "myprefix.resource.project.applications.0.clientDataTarget.file.path",
                "/tmp/c.json",
            ),
            (
                "myprefix.resource.project.applications.0.method.api.authenticationMethod",
                "basic",
            ),
        ]);

        let resource = parse_labels(&labels, "myprefix");
        assert!(resource.is_ok());
        match &resource.unwrap().resource {
            RawZitadelResourceSelector::Project(project) => {
                assert!(project.project_role_assertion);
            }
        }
    }

    #[test]
    fn test_empty_labels_map() {
        let labels: HashMap<String, String> = HashMap::new();
        let result = parse_labels(&labels, "zrc");
        assert!(matches!(result.unwrap_err(), LabelParseError::NoLabelsFound(_)));
    }

    #[test]
    fn test_nested_array_conversion() {
        // Arrays inside objects inside arrays should all convert correctly
        let mut val = serde_json::json!({
            "0": {
                "items": {
                    "0": "a",
                    "1": "b"
                }
            },
            "1": {
                "items": {
                    "0": "c"
                }
            }
        });
        convert_numeric_objects_to_arrays(&mut val);
        assert_eq!(
            val,
            serde_json::json!([
                {"items": ["a", "b"]},
                {"items": ["c"]}
            ])
        );
    }

    #[test]
    fn test_multiple_applications() {
        let labels = make_labels(&[
            ("zrc.resource.project.projectRoleAssertion", "true"),
            ("zrc.resource.project.projectRoleCheck", "true"),
            ("zrc.resource.project.roles.0.key", "admin"),
            ("zrc.resource.project.roles.0.displayName", "Admins"),
            ("zrc.resource.project.roles.0.group", "admin"),
            ("zrc.resource.project.adminRoles.0", "admin"),
            // First app: OIDC
            ("zrc.resource.project.applications.0.name", "web-app"),
            (
                "zrc.resource.project.applications.0.clientDataTarget.file.path",
                "/tmp/web.json",
            ),
            (
                "zrc.resource.project.applications.0.method.oidc.redirectUris.0",
                "https://web.example.com/callback",
            ),
            (
                "zrc.resource.project.applications.0.method.oidc.responseTypes.0",
                "code",
            ),
            (
                "zrc.resource.project.applications.0.method.oidc.grantTypes.0",
                "authorizationCode",
            ),
            (
                "zrc.resource.project.applications.0.method.oidc.appType",
                "web",
            ),
            (
                "zrc.resource.project.applications.0.method.oidc.authenticationMethod",
                "basic",
            ),
            (
                "zrc.resource.project.applications.0.method.oidc.accessTokenType",
                "bearer",
            ),
            // Second app: API
            ("zrc.resource.project.applications.1.name", "api-svc"),
            (
                "zrc.resource.project.applications.1.clientDataTarget.file.path",
                "/tmp/api.json",
            ),
            (
                "zrc.resource.project.applications.1.method.api.authenticationMethod",
                "basic",
            ),
        ]);

        let resource = parse_labels(&labels, "zrc").unwrap();
        match &resource.resource {
            RawZitadelResourceSelector::Project(project) => {
                assert_eq!(project.applications.len(), 2);
                assert_eq!(project.applications[0].name, "web-app");
                assert_eq!(project.applications[1].name, "api-svc");
                assert!(matches!(
                    project.applications[0].method,
                    crate::resource_types::RawZitadelApplicationMethod::Oidc(_)
                ));
                assert!(matches!(
                    project.applications[1].method,
                    crate::resource_types::RawZitadelApplicationMethod::Api(_)
                ));
            }
        }
    }

    #[test]
    fn test_multiline_script_value() {
        let labels = make_labels(&[
            ("zrc.resource.project.projectRoleAssertion", "true"),
            ("zrc.resource.project.projectRoleCheck", "true"),
            ("zrc.resource.project.roles.0.key", "admin"),
            ("zrc.resource.project.roles.0.displayName", "Admins"),
            ("zrc.resource.project.roles.0.group", "admin"),
            ("zrc.resource.project.adminRoles.0", "admin"),
            ("zrc.resource.project.applications.0.name", "app"),
            (
                "zrc.resource.project.applications.0.clientDataTarget.file.path",
                "/tmp/c.json",
            ),
            (
                "zrc.resource.project.applications.0.method.api.authenticationMethod",
                "basic",
            ),
            (
                "zrc.resource.project.actionFlow.actions.myAction.script",
                "function myAction(ctx, api) {\n  let x = 1;\n  api.v1.claims.setClaim('test', x);\n}",
            ),
            (
                "zrc.resource.project.actionFlow.flow.complementToken.preUserinfoCreation.0",
                "myAction",
            ),
        ]);

        let resource = parse_labels(&labels, "zrc").unwrap();
        match &resource.resource {
            RawZitadelResourceSelector::Project(project) => {
                let action_flow = project.action_flow.as_ref().unwrap();
                let action = &action_flow.actions["myAction"];
                assert!(action.script.contains('\n'));
                assert!(action.script.contains("myAction"));
            }
        }
    }
}
