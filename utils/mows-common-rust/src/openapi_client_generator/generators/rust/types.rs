// Types for building a proper not hacked together client types generator

pub trait ToRustCode {
    fn to_rust_code(&self) -> String;
}

#[derive(Debug, Clone, PartialEq)]
pub enum RustType {
    Struct(RustStruct),
    Enum(RustEnum),
    StandaloneType(RustStandaloneType),
}

#[derive(Debug, Clone, PartialEq)]
pub struct RustStandaloneType {
    pub name: String,
    pub rust_type: String,
    pub comment: Option<String>,
    pub visibility: Visibility,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RustStruct {
    pub name: String,
    pub comment: Option<String>,
    pub fields: Vec<RustStructField>,
    pub derives: Vec<String>,
    pub visibility: Visibility,
    pub serde_container_attrs: Vec<SerdeContainerAttr>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RustStructField {
    pub name: String,
    pub rust_type: String,
    pub comment: Option<String>,
    pub serde_attrs: Vec<SerdeFieldAttr>,
    pub visibility: Visibility,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RustEnum {
    pub name: String,
    pub comment: Option<String>,
    pub variants: Vec<RustEnumVariant>,
    pub derives: Vec<String>,
    pub visibility: Visibility,
    pub serde_container_attrs: Vec<SerdeContainerAttr>,
}

#[derive(Debug, Clone, PartialEq)]
pub enum RustEnumVariant {
    Simple(RustEnumEnumVariantSimple),
    Tuple(RustEnumVariantTuple),
    Struct(RustEnumVariantStruct),
}

#[derive(Debug, Clone, PartialEq)]
pub struct RustEnumEnumVariantSimple {
    pub name: String,
    pub comment: Option<String>,
    pub serde_attrs: Vec<SerdeFieldAttr>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RustEnumVariantTuple {
    pub name: String,
    pub types: Vec<String>,
    pub comment: Option<String>,
    pub serde_attrs: Vec<SerdeFieldAttr>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RustEnumVariantStruct {
    pub name: String,
    pub fields: Vec<RustStructField>,
    pub comment: Option<String>,
    pub serde_attrs: Vec<SerdeFieldAttr>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Visibility {
    Public,
    PublicCrate,
    Private,
}

#[derive(Debug, Clone, PartialEq)]
pub enum SerdeContainerAttr {
    RenameAll(String),
    Tag(String),
    Content(String),
    Untagged,
}

#[derive(Debug, Clone, PartialEq)]
pub enum SerdeFieldAttr {
    Rename(String),
    SkipSerializingIf(String),
    Default,
    DefaultValue(String),
    Flatten,
}

// Implementations

impl Visibility {
    fn to_string(&self) -> &'static str {
        match self {
            Visibility::Public => "pub ",
            Visibility::PublicCrate => "pub(crate) ",
            Visibility::Private => "",
        }
    }
}

impl SerdeContainerAttr {
    fn to_attribute_string(&self) -> String {
        match self {
            SerdeContainerAttr::RenameAll(strategy) => format!(r#"rename_all = "{}""#, strategy),
            SerdeContainerAttr::Tag(tag_name) => format!(r#"tag = "{}""#, tag_name),
            SerdeContainerAttr::Content(content_name) => {
                format!(r#"content = "{}""#, content_name)
            }
            SerdeContainerAttr::Untagged => "untagged".to_string(),
        }
    }
}

impl SerdeFieldAttr {
    fn to_attribute_string(&self) -> String {
        match self {
            SerdeFieldAttr::Rename(name) => format!(r#"rename = "{}""#, name),
            SerdeFieldAttr::SkipSerializingIf(fn_path) => {
                format!(r#"skip_serializing_if = "{}""#, fn_path)
            }
            SerdeFieldAttr::Default => "default".to_string(),
            SerdeFieldAttr::DefaultValue(value) => format!(r#"default = "{}""#, value),
            SerdeFieldAttr::Flatten => "flatten".to_string(),
        }
    }
}

fn format_doc_comment(comment: &Option<String>) -> String {
    match comment {
        Some(comment) => {
            let lines = comment
                .lines()
                .map(|line| format!("/// {}", line))
                .collect::<Vec<_>>()
                .join("\n");
            format!("{}\n", lines)
        }
        None => String::new(),
    }
}

fn format_derives(derives: &[String]) -> String {
    if derives.is_empty() {
        return String::new();
    }
    format!("#[derive({})]\n", derives.join(", "))
}

fn format_serde_container_attrs(attrs: &[SerdeContainerAttr]) -> String {
    if attrs.is_empty() {
        return String::new();
    }
    let attrs_str = attrs
        .iter()
        .map(|attr| attr.to_attribute_string())
        .collect::<Vec<_>>()
        .join(", ");
    format!("#[serde({})]\n", attrs_str)
}

impl ToRustCode for RustType {
    fn to_rust_code(&self) -> String {
        match self {
            RustType::Struct(s) => s.to_rust_code(),
            RustType::Enum(e) => e.to_rust_code(),
            RustType::StandaloneType(t) => t.to_rust_code(),
        }
    }
}

impl ToRustCode for RustStandaloneType {
    fn to_rust_code(&self) -> String {
        let mut code = String::new();
        code.push_str(&format_doc_comment(&self.comment));
        code.push_str(&format!(
            "{}type {} = {};",
            self.visibility.to_string(),
            self.name,
            self.rust_type
        ));
        code
    }
}

impl ToRustCode for RustStruct {
    fn to_rust_code(&self) -> String {
        let mut code = String::new();

        // Doc comment
        code.push_str(&format_doc_comment(&self.comment));

        // Derives
        code.push_str(&format_derives(&self.derives));

        // Serde container attributes
        code.push_str(&format_serde_container_attrs(&self.serde_container_attrs));

        // Struct definition
        code.push_str(&format!(
            "{}struct {} {{\n",
            self.visibility.to_string(),
            self.name
        ));

        // Fields
        for field in &self.fields {
            // Field doc comment
            if let Some(comment) = &field.comment {
                for line in comment.lines() {
                    code.push_str(&format!("    /// {}\n", line));
                }
            }

            // Field serde attributes
            if !field.serde_attrs.is_empty() {
                let attrs_str = field
                    .serde_attrs
                    .iter()
                    .map(|attr| attr.to_attribute_string())
                    .collect::<Vec<_>>()
                    .join(", ");
                code.push_str(&format!("    #[serde({})]\n", attrs_str));
            }

            // Field definition
            code.push_str(&format!(
                "    {}{}: {},\n",
                field.visibility.to_string(),
                field.name,
                field.rust_type
            ));
        }

        code.push_str("}");
        code
    }
}

impl ToRustCode for RustEnum {
    fn to_rust_code(&self) -> String {
        let mut code = String::new();

        // Doc comment
        code.push_str(&format_doc_comment(&self.comment));

        // Derives
        code.push_str(&format_derives(&self.derives));

        // Serde container attributes
        code.push_str(&format_serde_container_attrs(&self.serde_container_attrs));

        // Enum definition
        code.push_str(&format!(
            "{}enum {} {{\n",
            self.visibility.to_string(),
            self.name
        ));

        // Variants
        for variant in &self.variants {
            code.push_str(&variant.to_rust_code());
        }

        code.push_str("}");
        code
    }
}

impl ToRustCode for RustEnumVariant {
    fn to_rust_code(&self) -> String {
        match self {
            RustEnumVariant::Simple(v) => v.to_rust_code(),
            RustEnumVariant::Tuple(v) => v.to_rust_code(),
            RustEnumVariant::Struct(v) => v.to_rust_code(),
        }
    }
}

impl ToRustCode for RustEnumEnumVariantSimple {
    fn to_rust_code(&self) -> String {
        let mut code = String::new();

        // Variant doc comment
        if let Some(comment) = &self.comment {
            for line in comment.lines() {
                code.push_str(&format!("    /// {}\n", line));
            }
        }

        // Variant serde attributes
        if !self.serde_attrs.is_empty() {
            let attrs_str = self
                .serde_attrs
                .iter()
                .map(|attr| attr.to_attribute_string())
                .collect::<Vec<_>>()
                .join(", ");
            code.push_str(&format!("    #[serde({})]\n", attrs_str));
        }

        // Variant definition
        code.push_str(&format!("    {},\n", self.name));
        code
    }
}

impl ToRustCode for RustEnumVariantTuple {
    fn to_rust_code(&self) -> String {
        let mut code = String::new();

        // Variant doc comment
        if let Some(comment) = &self.comment {
            for line in comment.lines() {
                code.push_str(&format!("    /// {}\n", line));
            }
        }

        // Variant serde attributes
        if !self.serde_attrs.is_empty() {
            let attrs_str = self
                .serde_attrs
                .iter()
                .map(|attr| attr.to_attribute_string())
                .collect::<Vec<_>>()
                .join(", ");
            code.push_str(&format!("    #[serde({})]\n", attrs_str));
        }

        // Variant definition
        code.push_str(&format!("    {}({}),\n", self.name, self.types.join(", ")));
        code
    }
}

impl ToRustCode for RustEnumVariantStruct {
    fn to_rust_code(&self) -> String {
        let mut code = String::new();

        // Variant doc comment
        if let Some(comment) = &self.comment {
            for line in comment.lines() {
                code.push_str(&format!("    /// {}\n", line));
            }
        }

        // Variant serde attributes
        if !self.serde_attrs.is_empty() {
            let attrs_str = self
                .serde_attrs
                .iter()
                .map(|attr| attr.to_attribute_string())
                .collect::<Vec<_>>()
                .join(", ");
            code.push_str(&format!("    #[serde({})]\n", attrs_str));
        }

        // Variant struct definition
        code.push_str(&format!("    {} {{\n", self.name));

        for field in &self.fields {
            // Field doc comment
            if let Some(comment) = &field.comment {
                for line in comment.lines() {
                    code.push_str(&format!("        /// {}\n", line));
                }
            }

            // Field serde attributes
            if !field.serde_attrs.is_empty() {
                let attrs_str = field
                    .serde_attrs
                    .iter()
                    .map(|attr| attr.to_attribute_string())
                    .collect::<Vec<_>>()
                    .join(", ");
                code.push_str(&format!("        #[serde({})]\n", attrs_str));
            }

            // Field definition (no visibility modifier for enum variant fields - they're always public)
            code.push_str(&format!(
                "        {}: {},\n",
                field.name,
                field.rust_type
            ));
        }

        code.push_str("    },\n");
        code
    }
}
