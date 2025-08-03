use std::collections::HashMap;

use serde_json::Value;
use utoipa::{
    openapi::{
        schema::{ArrayItems, SchemaType},
        KnownFormat, RefOr, Schema, SchemaFormat, Type,
    },
    Number,
};

use crate::openapi_client_generator::ClientGeneratorError;

fn string_format(format: &SchemaFormat) -> Result<String, ClientGeneratorError> {
    Ok(match format {
        SchemaFormat::KnownFormat(known_format) => match known_format {
            KnownFormat::Uuid => "Uuid".to_string(),
            KnownFormat::DateTime => "NaiveDateTime".to_string(),
            _ => "PLACEHOLDER_KNOWN_FORMAT".to_string(),
        },
        SchemaFormat::Custom(_) => "PLACEHOLDER_CUSTOM_FORMAT".to_string(),
    })
}

fn int_format(format: &Option<SchemaFormat>, minimum: &Option<Number>) -> String {
    match format {
        Some(SchemaFormat::KnownFormat(KnownFormat::Int32)) => {
            if minimum.is_some() {
                "u32".to_string()
            } else {
                "i32".to_string()
            }
        }
        Some(SchemaFormat::KnownFormat(KnownFormat::Int64)) => {
            if minimum.is_some() {
                "u64".to_string()
            } else {
                "i64".to_string()
            }
        }
        Some(SchemaFormat::Custom(custom_format)) => {
            format!("PLACEHOLDER_CUSTOM_FORMAT_{}", custom_format)
        }
        _ => "i64".to_string(),
    }
}

fn float_format(format: &Option<SchemaFormat>) -> String {
    match format {
        Some(SchemaFormat::KnownFormat(KnownFormat::Float)) => "f32".to_string(),
        Some(SchemaFormat::KnownFormat(KnownFormat::Double)) => "f64".to_string(),
        Some(SchemaFormat::Custom(custom_format)) => {
            format!("PLACEHOLDER_CUSTOM_FORMAT_{}", custom_format)
        }
        _ => "f64".to_string(),
    }
}

fn schema_to_rust_type(
    all_types: &mut HashMap<String, String>,
    maybe_struct_name: Option<String>,
    schema: &Schema,
) -> Result<String, ClientGeneratorError> {
    Ok(match &schema {
        Schema::Array(array) => match &array.items {
            ArrayItems::RefOrSchema(ref_or) => {
                let item_type = ref_or_schema_to_rust_type(all_types, maybe_struct_name, ref_or)?;
                format!("Vec<{}>", item_type)
            }
            ArrayItems::False => todo!(),
        },
        Schema::Object(object) => match (&object.schema_type, &object.enum_values) {
            (SchemaType::Type(Type::String), Some(enum_values)) => {
                if enum_values.len() == 1 {
                    return Ok(enum_values[0].to_string().replace('"', ""));
                };
                let name = maybe_struct_name.unwrap();

                let enum_variants = enum_values
                    .iter()
                    .map(|value| match value {
                        Value::String(s) => s.replace('-', "_").replace(' ', "_"),
                        _ => {
                            todo!()
                        }
                    })
                    .collect::<Vec<_>>()
                    .join(",\n    ");

                format!(
                    r#"#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum {name} {{
    {enum_variants}
}}"#,
                )
            }

            (SchemaType::Type(Type::String), None) => match &object.format {
                Some(format) => string_format(&format)?,
                None => format!("String"),
            },
            (SchemaType::Type(Type::Integer), _) => int_format(&object.format, &object.minimum),
            (SchemaType::Type(Type::Number), _) => float_format(&object.format),
            (SchemaType::Type(Type::Boolean), _) => {
                format!("bool")
            }
            (SchemaType::Type(Type::Null), _) => {
                // Null type can be represented as Option<T>
                if maybe_struct_name.is_some() {
                    format!("Option<{}>", maybe_struct_name.unwrap())
                } else {
                    "Option<Value>".to_string()
                }
            }
            (SchemaType::Array(array), _) => {
                if array.iter().any(|item| *item == Type::Null) {
                    let other_array_item = array.iter().find(|item| *item != &Type::Null);

                    let inner_type = match other_array_item {
                        Some(Type::String) => "String".to_string(),
                        Some(Type::Integer) => int_format(&object.format, &object.minimum),

                        Some(Type::Number) => float_format(&object.format),
                        Some(Type::Boolean) => "bool".to_string(),
                        _ => "PLACEHOLDER_OTHER_ARRAY_ITEM".to_string(),
                    };

                    format!("Option<{}>", inner_type)
                } else {
                    "PLACEHOLDER_SCHEMA_ARRAY".to_string()
                }
            }
            (SchemaType::Type(Type::Object), _)
                if object.properties.is_empty()
                    && object.additional_properties.is_some()
                    && object.property_names.is_some() =>
            {
                let additional_properties = match *object.additional_properties.clone().unwrap() {
                    utoipa::openapi::schema::AdditionalProperties::RefOr(ref ref_or) => {
                        ref_or_schema_to_rust_type(all_types, maybe_struct_name, &ref_or)?
                    }
                    utoipa::openapi::schema::AdditionalProperties::FreeForm(_) => {
                        "PLACEHOLDER_FREE_FORM".to_string()
                    }
                };
                let index_type =
                    schema_to_rust_type(all_types, None, &object.property_names.clone().unwrap())?;

                format!("HashMap<{}, {}>", index_type, additional_properties)
            }
            _ => match maybe_struct_name {
                Some(struct_name) => {
                    let fields =
                        generate_struct_fields(all_types, Some(struct_name.clone()), object)?
                            .join("\n    ");

                    let struct_name = struct_name.replace('_', "");

                    format!(
                        r#"#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct {struct_name} {{
    {fields}
}}"#,
                    )
                }
                None => {
                    let fields = generate_struct_fields(all_types, None, object)?
                        .iter()
                        .map(|field| field.replace("pub ", ""))
                        .collect::<Vec<_>>()
                        .join("\n    ");
                    if fields.is_empty() {
                        return Ok("Value".to_string());
                    }
                    format!(
                        r#"{{
        {fields}
    }}"#,
                    )
                }
            },
        },
        Schema::OneOf(one_of) => {
            // a enum with inner types
            let mut rust_enum_variants = Vec::new();

            if one_of.items.len() == 2 {
                // If there are only two items and one is null, we can return an Option type

                let null_item = one_of.items.iter().find(|item| match item {
                    RefOr::T(Schema::Object(object)) => match object.schema_type {
                        SchemaType::Type(Type::Null) => true,
                        _ => false,
                    },
                    _ => false,
                });

                if null_item.is_some() {
                    let non_null_item = one_of.items.iter().find(|item| match item {
                        RefOr::T(Schema::Object(object)) => match object.schema_type {
                            SchemaType::Type(Type::Null) => false,
                            _ => true,
                        },
                        _ => true,
                    });
                    if let Some(non_null_item) = non_null_item {
                        let rust_type = ref_or_schema_to_rust_type(all_types, None, non_null_item)?;
                        return Ok(format!("Option<{}>", rust_type));
                    }

                    return Err(ClientGeneratorError::GenerationError(
                        "OneOf schema with two null items is not supported".to_string(),
                    ));
                }
            }
            let name = maybe_struct_name.expect("OneOf schema must have a name");

            for ref_or_schema in &one_of.items {
                match ref_or_schema {
                    RefOr::T(Schema::Object(object)) => match object.required.get(0).cloned() {
                        Some(enum_name) => match object.properties.get(&enum_name) {
                            Some(obj) => {
                                let enum_type = ref_or_schema_to_rust_type(all_types, None, obj)?;
                                if enum_type.starts_with("{") {
                                    rust_enum_variants.push(format!("{}{}", enum_name, enum_type));
                                } else {
                                    rust_enum_variants
                                        .push(format!("{}({})", enum_name, enum_type));
                                }
                            }
                            None => {}
                        },
                        None => {
                            rust_enum_variants.push(ref_or_schema_to_rust_type(
                                all_types,
                                None,
                                ref_or_schema,
                            )?);
                        }
                    },
                    _ => {
                        rust_enum_variants.push("PLACEHOLDER".to_string());
                    }
                }
            }

            let rust_enum_variants_joined = rust_enum_variants.join(",\n    ");

            format!(
                r#"#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum {name} {{
    {rust_enum_variants_joined}
}}"#,
            )
        }
        Schema::AllOf(_) => "PLACEHOLDER_AllOf".to_string(),
        Schema::AnyOf(_) => "PLACEHOLDER_AnyOf".to_string(),
        _ => {
            return Err(ClientGeneratorError::GenerationError(
                "Unsupported schema type".to_string(),
            ))
        }
    })
}

pub fn ref_or_schema_to_rust_type(
    all_types: &mut HashMap<String, String>,
    maybe_struct_name: Option<String>,
    schema: &RefOr<Schema>,
) -> Result<String, ClientGeneratorError> {
    Ok(match schema {
        RefOr::Ref(reference) => reference
            .ref_location
            .split('/')
            .last()
            .ok_or(ClientGeneratorError::GenerationError(
                "Failed to extract type name from reference".to_string(),
            ))?
            .to_string(),
        RefOr::T(schema_obj) => schema_to_rust_type(all_types, maybe_struct_name, schema_obj)?,
    })
}

fn generate_struct_fields(
    types: &mut HashMap<String, String>,
    maybe_struct_name: Option<String>,
    object: &utoipa::openapi::Object,
) -> Result<Vec<String>, ClientGeneratorError> {
    let mut fields = Vec::new();
    for (struct_field_name, schema) in &object.properties {
        let mut struct_field_rust_type = ref_or_schema_to_rust_type(types, None, schema)?;

        if let Some(ref struct_name) = maybe_struct_name {
            if struct_name.contains("_") && struct_field_name == "data" {
                struct_field_rust_type = struct_name
                    .split('_')
                    .nth(1)
                    .unwrap_or("PLACEHOLDER-ASSUMED-GENERIC")
                    .to_string()
                    .replace("_", "")
            }
        };

        fields.push(format!(
            "pub {}: {},",
            struct_field_name, struct_field_rust_type
        ));
    }
    Ok(fields)
}
