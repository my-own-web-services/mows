/// Label conversion utilities for Docker Compose files
///
/// This module provides functions to convert between flat dot-notation labels
/// (e.g., "traefik.http.routers.myapp.rule=Host(`example.com`)") and nested
/// tree structures (e.g., `traefik: { http: { routers: { myapp: { rule: "Host(`example.com`)" } } } }`).

use anyhow::{anyhow, Context, Result};
use serde_yaml::{Mapping, Value};

/// Convert flat dot-notation labels to nested tree structure
///
/// Supports:
/// - Dot notation: `foo.bar.baz` → `{ foo: { bar: { baz: ... } } }`
/// - Array notation: `foo[0].bar` → `{ foo: [{ bar: ... }] }`
pub fn labels_to_tree(labels: Value) -> Result<Value> {
    let labels = match labels {
        Value::Mapping(m) => m,
        Value::Sequence(s) => convert_labels_sequence_to_mapping(s)?,
        _ => return Err(anyhow!("Labels must be a mapping or sequence")),
    };

    let mut new_labels = Mapping::new();

    for (label_key, label_value) in labels.into_iter() {
        let label_key_str = label_key
            .as_str()
            .ok_or_else(|| anyhow!("Label key must be a string"))?;

        let label_key_objects: Vec<&str> = label_key_str.split('.').collect();
        let mut current_obj = &mut new_labels;

        // Navigate/create nested structure for all but the last segment
        for &obj in label_key_objects.iter().take(label_key_objects.len() - 1) {
            let lbracket = obj.rfind('[');
            let rbracket = obj.rfind(']');

            if let (Some(lbracket), Some(rbracket)) = (lbracket, rbracket) {
                // Handle array notation: key[index]
                let idx: usize = obj[(lbracket + 1)..rbracket]
                    .parse()
                    .context("Invalid array index in label")?;
                let obj = Value::String(obj[..lbracket].into());

                let sequence = current_obj
                    .entry(obj)
                    .or_insert(Value::Sequence(vec![]))
                    .as_sequence_mut()
                    .ok_or_else(|| anyhow!("Expected sequence"))?;

                if sequence.len() < idx + 1 {
                    sequence.resize(idx + 1, Value::Null);
                }
                if sequence[idx] == Value::Null {
                    sequence[idx] = Value::Mapping(Mapping::new());
                }
                current_obj = sequence[idx]
                    .as_mapping_mut()
                    .ok_or_else(|| anyhow!("Expected mapping"))?;
            } else {
                // Handle regular dot notation
                let obj = Value::String(obj.into());
                current_obj = current_obj
                    .entry(obj)
                    .or_insert(Value::Mapping(Mapping::new()))
                    .as_mapping_mut()
                    .ok_or_else(|| anyhow!("Expected mapping"))?;
            }
        }

        // Insert the final value
        let last_label_obj = label_key_objects[label_key_objects.len() - 1];
        current_obj.insert(Value::String(last_label_obj.into()), label_value);
    }

    Ok(Value::Mapping(new_labels))
}

/// Convert nested tree structure to flat dot-notation labels
///
/// Supports:
/// - Nested objects: `{ foo: { bar: { baz: "value" } } }` → `foo.bar.baz=value`
/// - Arrays: `{ foo: [{ bar: "value" }] }` → `foo[0].bar=value`
pub fn tree_to_labels(tree: Value) -> Result<Value> {
    let tree = match tree {
        Value::Mapping(m) => m,
        _ => return Err(anyhow!("Tree must be a mapping")),
    };

    let mut new_labels = Mapping::new();

    for (label_key, label_value) in tree {
        let label_key_str = label_key
            .as_str()
            .ok_or_else(|| anyhow!("Label key must be a string"))?;

        for (k, v) in convert_single_label(label_key_str, label_value) {
            new_labels.insert(Value::String(k), v);
        }
    }

    Ok(Value::Mapping(new_labels))
}

fn convert_labels_sequence_to_mapping(labels: Vec<Value>) -> Result<Mapping> {
    let converted: Result<Vec<_>> = labels
        .into_iter()
        .map(|label| {
            let label = label
                .as_str()
                .ok_or_else(|| anyhow!("Label must be a string"))?;
            let (label_key, mut label_value) = label.split_once('=').unwrap_or((label, ""));

            // Prevent double escaped strings
            if label_value.starts_with('"') && label_value.ends_with('"') {
                label_value = &label_value[1..(label_value.len() - 1)];
            }

            let (label_key, label_value): (String, String) = (label_key.into(), label_value.into());

            Ok((Value::String(label_key), Value::String(label_value)))
        })
        .collect();

    Ok(converted?.into_iter().collect())
}

fn convert_single_label(label_key: &str, label_value: Value) -> Vec<(String, Value)> {
    match label_value {
        Value::Null | Value::Bool(_) | Value::Number(_) | Value::String(_) => {
            vec![(label_key.into(), label_value)]
        }
        Value::Sequence(seq) => seq
            .into_iter()
            .enumerate()
            .flat_map(|(idx, val)| {
                let new_key = format!("{label_key}[{idx}]");
                convert_single_label(&new_key, val)
            })
            .collect(),
        Value::Mapping(map) => map
            .into_iter()
            .flat_map(|(key, val)| {
                let key_str = key.as_str().expect("map key must be a string");
                let new_key = format!("{label_key}.{key_str}");
                convert_single_label(&new_key, val)
            })
            .collect(),
        Value::Tagged(_) => vec![(label_key.into(), label_value)],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_dot_notation() {
        let labels = serde_yaml::from_str::<Value>(
            r#"
traefik.http.routers.myapp.rule: "Host(`example.com`)"
traefik.http.routers.myapp.entrypoints: web
"#,
        )
        .unwrap();

        let tree = labels_to_tree(labels).unwrap();
        let result = tree_to_labels(tree).unwrap();

        assert!(result.get("traefik.http.routers.myapp.rule").is_some());
        assert!(result.get("traefik.http.routers.myapp.entrypoints").is_some());
    }

    #[test]
    fn test_array_notation() {
        let labels = serde_yaml::from_str::<Value>(
            r#"
"items[0].name": "first"
"items[0].value": "1"
"items[1].name": "second"
"items[1].value": "2"
"#,
        )
        .unwrap();

        let tree = labels_to_tree(labels).unwrap();

        // Verify tree structure
        assert!(tree.get("items").is_some());
        let items = tree.get("items").unwrap().as_sequence().unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(
            items[0].get("name").unwrap().as_str().unwrap(),
            "first"
        );

        // Convert back
        let result = tree_to_labels(tree).unwrap();
        assert!(result.get("items[0].name").is_some());
        assert!(result.get("items[1].name").is_some());
    }

    #[test]
    fn test_sequence_labels() {
        let labels = serde_yaml::from_str::<Value>(
            r#"
- "foo.bar=value1"
- "foo.baz=value2"
"#,
        )
        .unwrap();

        let tree = labels_to_tree(labels).unwrap();
        assert!(tree.get("foo").is_some());
        assert!(tree.get("foo").unwrap().get("bar").is_some());
    }

    #[test]
    fn test_roundtrip() {
        let original = serde_yaml::from_str::<Value>(
            r#"
traefik.http.routers.myapp.rule: "Host(`example.com`)"
traefik.http.routers.myapp.priority: "100"
traefik.http.services.myapp.loadbalancer.server.port: "8080"
"#,
        )
        .unwrap();

        let tree = labels_to_tree(original.clone()).unwrap();
        let back = tree_to_labels(tree).unwrap();

        // All keys should be preserved
        assert_eq!(
            original.as_mapping().unwrap().len(),
            back.as_mapping().unwrap().len()
        );
    }
}
