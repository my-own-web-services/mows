use serde_json::Value;
use utoipa::openapi::{
    schema::{ArrayItems, SchemaType},
    KnownFormat, RefOr, Schema, SchemaFormat, Type,
};

use crate::openapi_client_generator::ClientGeneratorError;

use super::{types::*, RustGeneratorConfig};

/// Convert an OpenAPI schema to a Rust type definition
pub fn openapi_schema_to_rust_type(
    type_name: Option<String>,
    schema: &RefOr<Schema>,
    config: &RustGeneratorConfig,
) -> Result<Option<RustType>, ClientGeneratorError> {
    match schema {
        RefOr::Ref(_reference) => {
            // References don't create new types, they just reference existing ones
            Ok(None)
        }
        RefOr::T(schema_obj) => {
            if let Some(name) = type_name {
                schema_to_rust_type(name, schema_obj, config)
            } else {
                // Inline schema without a name, can't create a top-level type
                Ok(None)
            }
        }
    }
}

fn schema_to_rust_type(
    type_name: String,
    schema: &Schema,
    config: &RustGeneratorConfig,
) -> Result<Option<RustType>, ClientGeneratorError> {
    match schema {
        Schema::Array(_array) => {
            // Arrays don't create new types, they use Vec<T>
            Ok(None)
        }
        Schema::Object(object) => object_schema_to_rust_type(type_name, object, config),
        Schema::OneOf(one_of) => one_of_schema_to_rust_enum(type_name, one_of),
        Schema::AllOf(_all_of) => {
            // TODO: Implement AllOf support
            Ok(None)
        }
        Schema::AnyOf(_any_of) => {
            // TODO: Implement AnyOf support
            Ok(None)
        }
        _ => Ok(None),
    }
}

/// Convert OpenAPI Object schema to Rust type
fn object_schema_to_rust_type(
    type_name: String,
    object: &utoipa::openapi::Object,
    config: &RustGeneratorConfig,
) -> Result<Option<RustType>, ClientGeneratorError> {
    match (&object.schema_type, &object.enum_values) {
        // String enum
        (SchemaType::Type(Type::String), Some(enum_values)) => {
            if enum_values.len() == 1 {
                // Single value enum is just a literal, return None
                return Ok(None);
            }

            Ok(Some(RustType::Enum(string_enum_to_rust_enum(
                type_name,
                object,
                enum_values,
            )?)))
        }

        // Regular struct with properties
        (SchemaType::Type(Type::Object), _) if !object.properties.is_empty() => Ok(Some(
            RustType::Struct(object_to_rust_struct(type_name, object, config)?),
        )),

        // HashMap with additionalProperties
        (SchemaType::Type(Type::Object), _)
            if object.properties.is_empty()
                && object.additional_properties.is_some()
                && object.property_names.is_some() =>
        {
            // This is a HashMap type, create a type alias
            let additional_properties_type = match *object.additional_properties.clone().unwrap() {
                utoipa::openapi::schema::AdditionalProperties::RefOr(ref ref_or) => {
                    ref_or_to_rust_type_string(ref_or)?
                }
                utoipa::openapi::schema::AdditionalProperties::FreeForm(_) => "Value".to_string(),
            };

            let index_type =
                simple_schema_to_rust_type_string(&object.property_names.clone().unwrap())?;

            Ok(Some(RustType::StandaloneType(RustStandaloneType {
                name: to_pascal_case(&type_name),
                rust_type: format!("HashMap<{}, {}>", index_type, additional_properties_type),
                comment: object.description.clone(),
                visibility: Visibility::Public,
            })))
        }

        // Empty object - create an empty struct
        (SchemaType::Type(Type::Object), _) if object.properties.is_empty() => {
            Ok(Some(RustType::Struct(RustStruct {
                name: to_pascal_case(&type_name),
                comment: object.description.clone(),
                fields: vec![],
                derives: vec![
                    "Debug".to_string(),
                    "Clone".to_string(),
                    "Serialize".to_string(),
                    "Deserialize".to_string(),
                ],
                visibility: Visibility::Public,
                serde_container_attrs: vec![],
            })))
        }

        // Primitive types - create type aliases
        (SchemaType::Type(ty), _) => {
            let rust_type_str = primitive_type_to_rust_string(ty, object)?;
            Ok(Some(RustType::StandaloneType(RustStandaloneType {
                name: to_pascal_case(&type_name),
                rust_type: rust_type_str,
                comment: object.description.clone(),
                visibility: Visibility::Public,
            })))
        }

        // Nullable types
        (SchemaType::Array(types), _) if types.contains(&Type::Null) => {
            let non_null_type = types.iter().find(|t| **t != Type::Null);
            if let Some(inner_type) = non_null_type {
                let rust_type_str = primitive_type_to_rust_string(inner_type, object)?;
                Ok(Some(RustType::StandaloneType(RustStandaloneType {
                    name: to_pascal_case(&type_name),
                    rust_type: format!("Option<{}>", rust_type_str),
                    comment: object.description.clone(),
                    visibility: Visibility::Public,
                })))
            } else {
                Ok(None)
            }
        }

        _ => Ok(None),
    }
}

fn string_enum_to_rust_enum(
    type_name: String,
    object: &utoipa::openapi::Object,
    enum_values: &[Value],
) -> Result<RustEnum, ClientGeneratorError> {
    let variants = enum_values
        .iter()
        .filter_map(|value| {
            if let Value::String(s) = value {
                Some(string_to_enum_variant(s))
            } else {
                None
            }
        })
        .collect();

    Ok(RustEnum {
        name: to_pascal_case(&type_name),
        comment: object.description.clone(),
        variants,
        derives: vec![
            "Debug".to_string(),
            "Clone".to_string(),
            "Serialize".to_string(),
            "Deserialize".to_string(),
        ],
        visibility: Visibility::Public,
        serde_container_attrs: vec![],
    })
}

fn string_to_enum_variant(s: &str) -> RustEnumVariant {
    let needs_rename =
        s.starts_with(char::is_lowercase) || s.contains(|c: char| !c.is_alphanumeric() && c != '_');

    let variant_name = if s.starts_with(char::is_lowercase) {
        // Capitalize first letter
        let mut chars = s.chars();
        match chars.next() {
            Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
            None => s.to_string(),
        }
    } else {
        s.to_string()
    };

    let serde_attrs = if needs_rename {
        vec![SerdeFieldAttr::Rename(s.to_string())]
    } else {
        vec![]
    };

    RustEnumVariant::Simple(RustEnumEnumVariantSimple {
        name: variant_name,
        comment: None,
        serde_attrs,
    })
}

fn object_to_rust_struct(
    type_name: String,
    object: &utoipa::openapi::Object,
    config: &RustGeneratorConfig,
) -> Result<RustStruct, ClientGeneratorError> {
    let fields = object
        .properties
        .iter()
        .map(|(field_name, schema)| {
            let mut rust_type = ref_or_to_rust_type_string(schema)?;

            // Special handling for generic response wrappers
            // If struct name contains underscore and field is "data", extract the actual type
            // Example: ApiResponse_GetAppsResponseBody -> data: GetAppsResponseBody
            let is_api_response_data = type_name.contains('_') && field_name == "data";
            let is_empty_response = is_api_response_data && {
                if let Some(extracted_type) = type_name.split('_').nth(1) {
                    extracted_type.contains("Empty")
                } else {
                    false
                }
            };

            if is_api_response_data {
                if let Some(extracted_type) = type_name.split('_').nth(1) {
                    if extracted_type.contains("EmptyApiResponse") {
                        // Empty API response should be Option<()>
                        rust_type = "()".to_string();
                    } else {
                        rust_type = to_pascal_case(extracted_type);
                    }
                }
            }

            // Check if field is required
            // For API response wrappers with data, the field is required unless it's an empty response
            let is_required = object.required.contains(field_name)
                || (is_api_response_data && !is_empty_response);

            // Only wrap in Option if not required AND not already Option
            let final_rust_type = if !is_required && !rust_type.starts_with("Option<") {
                format!("Option<{}>", rust_type)
            } else {
                rust_type
            };

            // Extract description from schema
            let description = extract_schema_description(schema);

            // Add serde rename if field name is not valid Rust
            let needs_rename = field_name.contains(|c: char| !c.is_alphanumeric() && c != '_')
                || field_name.starts_with(char::is_numeric);

            let serde_attrs = if needs_rename {
                vec![SerdeFieldAttr::Rename(field_name.to_string())]
            } else {
                vec![]
            };

            Ok(RustStructField {
                name: if needs_rename {
                    sanitize_field_name(field_name)
                } else {
                    field_name.clone()
                },
                rust_type: final_rust_type,
                comment: description,
                serde_attrs,
                visibility: Visibility::Public,
            })
        })
        .collect::<Result<Vec<_>, ClientGeneratorError>>()?;

    // Check if all fields are optional
    let all_fields_optional = !fields.is_empty() &&
        fields.iter().all(|field| field.rust_type.starts_with("Option<"));

    // Build derives list
    let mut derives = vec![
        "Debug".to_string(),
        "Clone".to_string(),
        "Serialize".to_string(),
        "Deserialize".to_string(),
    ];

    // Add Default if config option is enabled and all fields are optional
    if config.derive_default_for_all_optional_structs && all_fields_optional {
        derives.push("Default".to_string());
    }

    Ok(RustStruct {
        name: to_pascal_case(&type_name),
        comment: object.description.clone(),
        fields,
        derives,
        visibility: Visibility::Public,
        serde_container_attrs: vec![],
    })
}

fn one_of_schema_to_rust_enum(
    type_name: String,
    one_of: &utoipa::openapi::OneOf,
) -> Result<Option<RustType>, ClientGeneratorError> {
    // Check if this is just Option<T> (oneOf with null)
    if one_of.items.len() == 2 {
        let has_null = one_of.items.iter().any(|item| {
            matches!(
                item,
                RefOr::T(Schema::Object(obj)) if matches!(obj.schema_type, SchemaType::Type(Type::Null))
            )
        });

        if has_null {
            // This is Option<T>, create a type alias
            let non_null_item = one_of.items.iter().find(|item| {
                !matches!(
                    item,
                    RefOr::T(Schema::Object(obj)) if matches!(obj.schema_type, SchemaType::Type(Type::Null))
                )
            });

            if let Some(item) = non_null_item {
                let rust_type = ref_or_to_rust_type_string(item)?;
                return Ok(Some(RustType::StandaloneType(RustStandaloneType {
                    name: to_pascal_case(&type_name),
                    rust_type: format!("Option<{}>", rust_type),
                    comment: one_of.description.clone(),
                    visibility: Visibility::Public,
                })));
            }
        }
    }

    // Check if this is a discriminated union (has discriminator)
    let serde_container_attrs = if let Some(discriminator) = &one_of.discriminator {
        // Use tagged enum representation with the discriminator field name
        vec![SerdeContainerAttr::Tag(discriminator.property_name.clone())]
    } else {
        // For oneOf with mixed simple/struct variants, use default representation (internally tagged)
        // Don't add untagged - Rust's default enum representation works well here
        vec![]
    };

    let variants = one_of
        .items
        .iter()
        .enumerate()
        .filter_map(|(idx, item)| match item {
            RefOr::Ref(reference) => {
                // Extract type name from reference
                let fallback = format!("Variant{}", idx);
                let ref_type_name = reference
                    .ref_location
                    .split('/')
                    .last()
                    .unwrap_or(&fallback);

                Some(RustEnumVariant::Tuple(RustEnumVariantTuple {
                    name: ref_type_name.to_string(),
                    types: vec![ref_type_name.to_string()],
                    comment: None,
                    serde_attrs: vec![],
                }))
            }
            RefOr::T(Schema::Object(object)) => {
                // Check if this is a string enum with a single value
                if let (SchemaType::Type(Type::String), Some(enum_values)) =
                    (&object.schema_type, &object.enum_values)
                {
                    if enum_values.len() == 1 {
                        if let Some(Value::String(variant_name)) = enum_values.first() {
                            return Some(RustEnumVariant::Simple(RustEnumEnumVariantSimple {
                                name: variant_name.clone(),
                                comment: object.description.clone(),
                                serde_attrs: vec![],
                            }));
                        }
                    }
                }

                // Check if this is an object with a single property (discriminator pattern)
                if object.properties.len() == 1 {
                    if let Some((property_name, property_schema)) = object.properties.iter().next()
                    {
                        let variant_name = if property_name.starts_with(char::is_lowercase) {
                            // Capitalize first letter
                            let mut chars = property_name.chars();
                            match chars.next() {
                                Some(first) => {
                                    first.to_uppercase().collect::<String>() + chars.as_str()
                                }
                                None => property_name.to_string(),
                            }
                        } else {
                            property_name.to_string()
                        };

                        let needs_rename = property_name.starts_with(char::is_lowercase);
                        let serde_attrs = if needs_rename {
                            vec![SerdeFieldAttr::Rename(property_name.to_string())]
                        } else {
                            vec![]
                        };

                        // Check if the property is an inline object with named fields (not HashMap/additionalProperties)
                        match property_schema {
                            RefOr::T(Schema::Object(inner_object))
                                if !inner_object.properties.is_empty()
                                    && inner_object.additional_properties.is_none() =>
                            {
                                // This is an inline object with named fields - expand it into struct variant fields
                                let fields = inner_object
                                    .properties
                                    .iter()
                                    .filter_map(|(field_name, field_schema)| {
                                        let rust_type =
                                            ref_or_to_rust_type_string(field_schema).ok()?;

                                        // Check if field is required
                                        let is_required =
                                            inner_object.required.contains(field_name);
                                        let final_type = if !is_required {
                                            format!("Option<{}>", rust_type)
                                        } else {
                                            rust_type
                                        };

                                        // Extract description
                                        let description = extract_schema_description(field_schema);

                                        Some(RustStructField {
                                            name: field_name.clone(),
                                            rust_type: final_type,
                                            comment: description,
                                            serde_attrs: vec![],
                                            visibility: Visibility::Public,
                                        })
                                    })
                                    .collect();

                                Some(RustEnumVariant::Struct(RustEnumVariantStruct {
                                    name: variant_name,
                                    fields,
                                    comment: inner_object.description.clone(),
                                    serde_attrs,
                                }))
                            }
                            _ => {
                                // Reference, HashMap (additionalProperties), or simple type - use tuple variant
                                let inner_type =
                                    ref_or_to_rust_type_string(property_schema).ok()?;
                                let description = extract_schema_description(property_schema);

                                Some(RustEnumVariant::Tuple(RustEnumVariantTuple {
                                    name: variant_name,
                                    types: vec![inner_type],
                                    comment: description,
                                    serde_attrs,
                                }))
                            }
                        }
                    } else {
                        None
                    }
                } else if !object.properties.is_empty() {
                    // Multiple properties - create a struct variant
                    let first_required = object.required.first()?;

                    let variant_name = if first_required.starts_with(char::is_lowercase) {
                        let mut chars = first_required.chars();
                        match chars.next() {
                            Some(first) => {
                                first.to_uppercase().collect::<String>() + chars.as_str()
                            }
                            None => first_required.to_string(),
                        }
                    } else {
                        first_required.to_string()
                    };

                    let needs_rename = first_required.starts_with(char::is_lowercase);
                    let serde_attrs = if needs_rename {
                        vec![SerdeFieldAttr::Rename(first_required.to_string())]
                    } else {
                        vec![]
                    };

                    // Extract struct fields
                    let fields = object
                        .properties
                        .iter()
                        .filter_map(|(name, schema)| {
                            let rust_type = ref_or_to_rust_type_string(schema).ok()?;
                            let description = extract_schema_description(schema);
                            Some(RustStructField {
                                name: name.clone(),
                                rust_type,
                                comment: description,
                                serde_attrs: vec![],
                                visibility: Visibility::Public,
                            })
                        })
                        .collect();

                    Some(RustEnumVariant::Struct(RustEnumVariantStruct {
                        name: variant_name,
                        fields,
                        comment: object.description.clone(),
                        serde_attrs,
                    }))
                } else {
                    None
                }
            }
            _ => None,
        })
        .collect();

    Ok(Some(RustType::Enum(RustEnum {
        name: to_pascal_case(&type_name),
        comment: one_of.description.clone(),
        variants,
        derives: vec![
            "Debug".to_string(),
            "Clone".to_string(),
            "Serialize".to_string(),
            "Deserialize".to_string(),
        ],
        visibility: Visibility::Public,
        serde_container_attrs,
    })))
}

/// Convert a reference or schema to a Rust type string (for use in field types)
pub fn ref_or_to_rust_type_string(schema: &RefOr<Schema>) -> Result<String, ClientGeneratorError> {
    match schema {
        RefOr::Ref(reference) => {
            // Extract type name from reference
            Ok(reference
                .ref_location
                .split('/')
                .last()
                .ok_or(ClientGeneratorError::GenerationError(
                    "Failed to extract type name from reference".to_string(),
                ))?
                .to_string())
        }
        RefOr::T(schema_obj) => simple_schema_to_rust_type_string(schema_obj),
    }
}

fn simple_schema_to_rust_type_string(schema: &Schema) -> Result<String, ClientGeneratorError> {
    match schema {
        Schema::Array(array) => {
            match &array.items {
                ArrayItems::RefOrSchema(ref_or) => {
                    let item_type = ref_or_to_rust_type_string(ref_or)?;

                    // Check if array itself is nullable
                    let is_nullable = matches!(&array.schema_type, SchemaType::Array(types) if types.contains(&Type::Null));

                    if is_nullable {
                        Ok(format!("Option<Vec<{}>>", item_type))
                    } else {
                        Ok(format!("Vec<{}>", item_type))
                    }
                }
                ArrayItems::False => Err(ClientGeneratorError::GenerationError(
                    "Array with items: false is not supported".to_string(),
                )),
            }
        }
        Schema::Object(object) => {
            // Check if this is a HashMap (additionalProperties without regular properties)
            if object.properties.is_empty() && object.additional_properties.is_some() {
                let value_type = match *object.additional_properties.clone().unwrap() {
                    utoipa::openapi::schema::AdditionalProperties::RefOr(ref ref_or) => {
                        ref_or_to_rust_type_string(ref_or)?
                    }
                    utoipa::openapi::schema::AdditionalProperties::FreeForm(_) => {
                        "Value".to_string()
                    }
                };

                // Key type is usually String, but could be specified by property_names
                let key_type = if let Some(property_names_schema) = &object.property_names {
                    simple_schema_to_rust_type_string(property_names_schema)?
                } else {
                    "String".to_string()
                };

                Ok(format!("HashMap<{}, {}>", key_type, value_type))
            } else {
                primitive_type_to_rust_string_from_object(object)
            }
        }
        Schema::OneOf(one_of) => {
            // Check if this is inline oneOf: [null, Type] pattern (already handled in top-level)
            // This returns just the non-null type so it can be wrapped by the caller
            if one_of.items.len() == 2 {
                let has_null = one_of.items.iter().any(|item| {
                    matches!(
                        item,
                        RefOr::T(Schema::Object(obj)) if matches!(obj.schema_type, SchemaType::Type(Type::Null))
                    )
                });

                if has_null {
                    let non_null_item = one_of.items.iter().find(|item| {
                        !matches!(
                            item,
                            RefOr::T(Schema::Object(obj)) if matches!(obj.schema_type, SchemaType::Type(Type::Null))
                        )
                    });

                    if let Some(item) = non_null_item {
                        // Return just the non-null type, let the caller decide about Option wrapping
                        return ref_or_to_rust_type_string(item);
                    }
                }
            }

            // Complex oneOf without a name - fall back to Value
            Ok("Value".to_string())
        }
        Schema::AllOf(_) => {
            // Inline allOf - could be composition
            Ok("Value".to_string())
        }
        Schema::AnyOf(_) => {
            // Inline anyOf
            Ok("Value".to_string())
        }
        _ => Ok("Value".to_string()),
    }
}

fn primitive_type_to_rust_string_from_object(
    object: &utoipa::openapi::Object,
) -> Result<String, ClientGeneratorError> {
    match &object.schema_type {
        SchemaType::Type(ty) => primitive_type_to_rust_string(ty, object),
        SchemaType::Array(types) => {
            // Check for nullable types (e.g., type: ["string", "null"])
            if types.contains(&Type::Null) {
                let non_null = types.iter().find(|t| **t != Type::Null);
                if let Some(ty) = non_null {
                    // Type can be null, wrap in Option
                    let inner = primitive_type_to_rust_string(ty, object)?;
                    Ok(format!("Option<{}>", inner))
                } else {
                    Ok("Option<Value>".to_string())
                }
            } else {
                // Multiple types without null - not directly supported
                Ok("Value".to_string())
            }
        }
        SchemaType::AnyValue => Ok("Value".to_string()),
    }
}

fn primitive_type_to_rust_string(
    ty: &Type,
    object: &utoipa::openapi::Object,
) -> Result<String, ClientGeneratorError> {
    Ok(match ty {
        Type::String => match &object.format {
            Some(SchemaFormat::KnownFormat(KnownFormat::Uuid)) => "Uuid".to_string(),
            Some(SchemaFormat::KnownFormat(KnownFormat::DateTime)) => "NaiveDateTime".to_string(),
            Some(SchemaFormat::KnownFormat(KnownFormat::Date)) => "NaiveDate".to_string(),
            Some(SchemaFormat::Custom(custom)) => {
                format!("/* custom format: {} */ String", custom)
            }
            _ => "String".to_string(),
        },
        Type::Integer => match &object.format {
            Some(SchemaFormat::KnownFormat(KnownFormat::Int32)) => {
                if object.minimum.is_some() {
                    "u32".to_string()
                } else {
                    "i32".to_string()
                }
            }
            Some(SchemaFormat::KnownFormat(KnownFormat::Int64)) => {
                if object.minimum.is_some() {
                    "u64".to_string()
                } else {
                    "i64".to_string()
                }
            }
            _ => "i64".to_string(),
        },
        Type::Number => match &object.format {
            Some(SchemaFormat::KnownFormat(KnownFormat::Float)) => "f32".to_string(),
            Some(SchemaFormat::KnownFormat(KnownFormat::Double)) => "f64".to_string(),
            _ => "f64".to_string(),
        },
        Type::Boolean => "bool".to_string(),
        Type::Null => "()".to_string(),
        Type::Object => "Value".to_string(),
        Type::Array => "Vec<Value>".to_string(),
    })
}

fn sanitize_field_name(name: &str) -> String {
    // Remove invalid characters and replace with underscore
    name.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

fn to_pascal_case(name: &str) -> String {
    // Convert underscore-separated or hyphen-separated names to PascalCase
    // ApiResponse_GetAppsResponseBody -> ApiResponseGetAppsResponseBody
    // some-type-name -> SomeTypeName
    name.split(|c| c == '_' || c == '-')
        .filter(|s| !s.is_empty())
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
                None => String::new(),
            }
        })
        .collect()
}

fn extract_schema_description(schema: &RefOr<Schema>) -> Option<String> {
    match schema {
        RefOr::Ref(_) => None,
        RefOr::T(schema_obj) => match schema_obj {
            Schema::Object(obj) => obj.description.clone(),
            Schema::Array(arr) => arr.description.clone(),
            Schema::OneOf(one_of) => one_of.description.clone(),
            Schema::AllOf(all_of) => all_of.description.clone(),
            Schema::AnyOf(any_of) => any_of.description.clone(),
            _ => None,
        },
    }
}
