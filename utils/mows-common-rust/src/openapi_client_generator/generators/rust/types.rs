// Types for building a proper not hacked together client types generator

pub enum RustType {
    Struct(RustStruct),
    Enum(RustEnum),
    StandaloneType(RustStandaloneType),
}

pub struct RustStandaloneType {
    pub name: String,
    pub rust_type: String,
    pub comment: Option<String>,
}

pub struct RustStruct {
    pub name: String,
    pub comment: Option<String>,
    pub fields: Vec<RustStructField>,
}

pub struct RustStructField {
    pub name: String,
    pub rust_type: String,
    pub optional: bool,
    pub comment: Option<String>,
    pub rename: Option<String>,
}

pub struct RustEnum {
    pub name: String,
    pub comment: Option<String>,
    pub variants: Vec<RustEnumVariant>,
}

pub enum RustEnumVariant {
    Simple(RustEnumEnumVariantSimple),
    ExternalStruct(RustEnumVariantExternalStruct),
    InternalStruct(RustEnumVariantInternalStruct),
}

pub struct RustEnumEnumVariantSimple {
    pub name: String,
    pub comment: Option<String>,
    pub rename: Option<String>,
}

pub struct RustEnumVariantExternalStruct {
    pub name: String,
    pub rust_type: String,
    pub comment: Option<String>,
    pub rename: Option<String>,
}

pub struct RustEnumVariantInternalStruct {
    pub name: String,
    pub fields: Vec<RustStructField>,
    pub comment: Option<String>,
    pub rename: Option<String>,
}
