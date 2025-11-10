use crate::{config::routing_config::RoutingConfig, some_or_bail};
use anyhow::{bail, Context, Result};
use serde_yaml::{Mapping, Value};
use std::collections::HashMap;
use tracing::debug;

pub fn convert_traefik_labels_to_config(
    old_labels: HashMap<String, String>,
    container_name: &str,
) -> Result<RoutingConfig> {
    let new_labels = replace_variables(old_labels, container_name)?;
    let val = convert_traefik_labels_to_structure(new_labels, container_name)?;
    //dbg!(&val);
    //dbg!(&container_name);
    let traefik_inner = match val.get("traefik") {
        Some(v) => v,
        None => bail!("traefik not found"),
    };

    let config: RoutingConfig = serde_yaml::from_value(traefik_inner.clone())?;
    Ok(config)
}

pub fn replace_variables(
    labels: HashMap<String, String>,
    container_name: &str,
) -> anyhow::Result<HashMap<String, String>> {
    let mut new_labels = HashMap::<String, String>::new();
    for label in &labels {
        new_labels.insert(
            label.0.replace("{container_name}", container_name),
            label.1.replace("{container_name}", container_name),
        );
    }
    Ok(new_labels)
}

pub fn convert_traefik_labels_to_structure(
    old_labels: HashMap<String, String>,
    container_name: &str,
) -> Result<Value> {
    let mut new_labels = Mapping::new();
    for (label_key, label_value) in old_labels.into_iter() {
        let mut label_key_objects = label_key.as_str().split('.').collect::<Vec<&str>>();
        let mut current_obj = &mut new_labels;

        if label_key_objects.len() >= 6 && label_key_objects[5] == "server" {
            label_key_objects[5] = "servers[0]";
        }
        //dbg!(&label_key_objects);

        for (i, &obj) in label_key_objects
            .iter()
            .take(label_key_objects.len())
            .enumerate()
        {
            let lbracket = obj.rfind('[');
            let rbracket = obj.rfind(']');

            if let (Some(lbracket), Some(rbracket)) = (lbracket, rbracket) {
                let idx: usize = obj[(lbracket + 1)..rbracket]
                    .parse()
                    .context("Invalid array index in label")?;

                let obj = Value::String(obj[..lbracket].into());

                let sequence = current_obj
                    .entry(obj)
                    .or_insert(Value::Sequence(vec![]))
                    .as_sequence_mut()
                    .unwrap();

                if sequence.len() < idx + 1 {
                    sequence.resize(idx + 1, Value::Null);
                }

                if i < label_key_objects.len() - 1 {
                    sequence[idx] = Value::Mapping(Mapping::new());
                } else {
                    sequence[idx] = Value::String(label_value);
                    break;
                }

                current_obj = sequence[idx].as_mapping_mut().unwrap();
            } else {
                if i == label_key_objects.len() - 1 {
                    let last_label_obj = label_key_objects[label_key_objects.len() - 1];

                    // many band aids here that will break in certain cases
                    if (label_value.contains(',') && last_label_obj != "rule")
                        || last_label_obj == "entrypoints"
                        || last_label_obj == "middlewares"
                    {
                        let mut new_sequence = vec![];
                        for val in label_value.split(',') {
                            new_sequence.push(Value::String(val.trim().into()));
                        }
                        current_obj.insert(
                            Value::String(last_label_obj.into()),
                            Value::Sequence(new_sequence),
                        );
                    } else if last_label_obj == "rule"
                        && (label_value.to_lowercase().contains("hostregexp")
                            || label_value.to_lowercase().contains("path")
                            || label_value.to_lowercase().contains("pathprefix"))
                    {
                        current_obj.insert(
                            Value::String(last_label_obj.into()),
                            Value::String(
                                label_value
                                    .replace('{', "")
                                    .replace('}', "")
                                    .replace("subdomain:", "")
                                    .replace("path:", ""),
                            ),
                        );
                    } else if last_label_obj.to_lowercase() == "priority" {
                        // is a number

                        let n = match label_value.parse::<u32>() {
                            Ok(v) => v,
                            Err(_) => bail!("Failed to parse {last_label_obj} as number"),
                        };

                        current_obj.insert(
                            Value::String(last_label_obj.into()),
                            Value::Number(n.into()),
                        );
                    } else if last_label_obj.to_lowercase() == "maxrequestbodybytes" {
                        // is a number

                        let n = match label_value.parse::<u64>() {
                            Ok(v) => v,
                            Err(_) => bail!("Failed to parse {last_label_obj} as number"),
                        };

                        current_obj.insert(
                            Value::String(last_label_obj.into()),
                            Value::Number(n.into()),
                        );
                    } else if label_value == "true" {
                        current_obj.insert(Value::String(last_label_obj.into()), Value::Bool(true));
                    } else if label_value == "false" {
                        current_obj
                            .insert(Value::String(last_label_obj.into()), Value::Bool(false));
                    } else {
                        current_obj.insert(
                            Value::String(last_label_obj.into()),
                            Value::String(label_value),
                        );
                    }
                    break;
                }

                let obj = Value::String(obj.into());

                current_obj = some_or_bail!(current_obj
                    .entry(obj)
                    .or_insert(Value::Mapping(Mapping::new()))
                    .as_mapping_mut(),"Failed to insert new object into mapping: This is most likely due to a label being set twice by first setting it to a primitive value and then creating object/mapping keys on it.")
            }
        }
    }

    // handle url not beeing set for http
    if let Some(services) = new_labels.clone()["traefik"]["http"]["services"].as_mapping() {
        for (service_name, service) in services {
            let servers = &service["loadbalancer"]["servers"];
            if let Some(servers) = servers.as_sequence() {
                for (i, server) in servers.iter().enumerate() {
                    if server["url"].as_str().is_none() {
                        let url = format!(
                            "http://{}:{}",
                            container_name,
                            server["port"].as_str().unwrap_or("80")
                        );

                        new_labels["traefik"]["http"]["services"][service_name]["loadbalancer"]
                            ["servers"][i]["url"] = Value::String(url);
                    }
                }
            }
        }
    }

    // and address not beeing set for tcp
    if let Some(services) = new_labels.clone()["traefik"]["tcp"]["services"].as_mapping() {
        for (service_name, service) in services {
            let servers = &service["loadbalancer"]["servers"];
            if let Some(servers) = servers.as_sequence() {
                for (i, server) in servers.iter().enumerate() {
                    if server["address"].as_str().is_none() {
                        let address = format!(
                            "{}:{}",
                            container_name,
                            server["port"].as_str().unwrap_or("80")
                        );

                        new_labels["traefik"]["tcp"]["services"][service_name]["loadbalancer"]
                            ["servers"][i]["address"] = Value::String(address);
                    }
                }
            }
        }
    }

    // and udp
    if let Some(services) = new_labels.clone()["traefik"]["udp"]["services"].as_mapping() {
        for (service_name, service) in services {
            let servers = &service["loadbalancer"]["servers"];
            if let Some(servers) = servers.as_sequence() {
                for (i, server) in servers.iter().enumerate() {
                    if server["address"].as_str().is_none() {
                        let address = format!(
                            "{}:{}",
                            container_name,
                            server["port"].as_str().unwrap_or("80")
                        );

                        new_labels["traefik"]["udp"]["services"][service_name]["loadbalancer"]
                            ["servers"][i]["address"] = Value::String(address);
                    }
                }
            }
        }
    }

    if let Some(routers) = new_labels.clone()["traefik"]["http"]["routers"].as_mapping() {
        for (router_name, router) in routers {
            if router["service"].as_str().is_none() {
                new_labels["traefik"]["http"]["routers"][router_name]["service"] =
                    Value::String(container_name.into());
            }
        }
    }

    if let Some(routers) = new_labels.clone()["traefik"]["tcp"]["routers"].as_mapping() {
        for (router_name, router) in routers {
            if router["service"].as_str().is_none() {
                new_labels["traefik"]["tcp"]["routers"][router_name]["service"] =
                    Value::String(container_name.into());
            }
        }
    }

    if let Some(routers) = new_labels.clone()["traefik"]["udp"]["routers"].as_mapping() {
        for (router_name, router) in routers {
            if router["service"].as_str().is_none() {
                new_labels["traefik"]["udp"]["routers"][router_name]["service"] =
                    Value::String(container_name.into());
            }
        }
    }

    debug!(
        labels = %serde_json::to_string_pretty(&new_labels).unwrap(),
        "converted traefik labels to structure"
    );

    Ok(Value::Mapping(new_labels))
}
