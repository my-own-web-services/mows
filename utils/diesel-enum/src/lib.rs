//! This crate allows the user to represent state in the database using Rust enums. This is achieved
//! through a proc macro. First the macro looks at your chosen `sql_type`, and then it devises a
//! corresponding Rust type. The mapping is as follows:
//!
//! | SQL        | Rust     |
//! | ---------- | -------- |
//! | `SmallInt` | `i16`    |
//! | `Integer`  | `i32`    |
//! | `Int`      | `i32`    |
//! | `BigInt`   | `i64`    |
//! | `VarChar`  | `String` |
//! | `Text`     | `String` |
//!
//!  The macro then generates three impls: a `FromSql` impl, an `ToSql` impl and a
//! `TryFrom` impl, which allow conversion between the Sql type an the enum (`FromSql` and `ToSql`),
//! and from the Rust type into the enum (`TryInto`).
//!
//! ### Usage
//! ```rust
//! #[macro_use] extern crate diesel;
//! use diesel_enum::DbEnum;
//! use diesel::{deserialize::FromSqlRow, sql_types::SmallInt};
//!
//! #[derive(Debug, thiserror::Error)]
//! #[error("CustomError: {msg}, {status}")]
//! pub struct CustomError {
//!     msg: String,
//!     status: u16,
//! }
//!
//! impl CustomError {
//!     fn not_found(msg: String) -> Self {
//!         Self {
//!             msg,
//!             status: 404,
//!         }
//!     }
//! }
//!
//! #[derive(Debug, Clone, Copy, PartialEq, Eq, FromSqlRow, DbEnum)]
//! #[diesel(sql_type = SmallInt)]
//! #[diesel_enum(error_fn = CustomError::not_found)]
//! #[diesel_enum(error_type = CustomError)]
//! pub enum Status {
//!     /// Will be represented as 0.
//!     Ready,
//!     /// Will be represented as 1.
//!     Pending,
//! }
//! ```
//! Alternatively you can use strings, with will be cast to lowercase. (e.g. `Status::Ready` will be
//! stored as `"ready"` in the database):
//! ```rust
//! #[derive(Debug, Clone, Copy, PartialEq, Eq, FromSqlRow, DbEnum)]
//! #[diesel(sql_type = VarChar)]
//! #[diesel_enum(error_fn = CustomError::not_found)]
//! #[diesel_enum(error_type = CustomError)]
//! pub enum Status {
//!     /// Will be represented as `"ready"`.
//!     Ready,
//!     /// Will be represented as `"pending"`.
//!     Pending,
//! }
//! ```

use quote::quote;
use syn::spanned::Spanned;

macro_rules! try_or_return {
    ($inp:expr) => {
        match $inp {
            Ok(ok) => ok,
            Err(msg) => return msg.into(),
        }
    };
}

struct MacroState<'a> {
    name: syn::Ident,
    variants: Vec<&'a syn::Variant>,
    sql_type: syn::Ident,
    rust_type: syn::Ident,
    error_type: syn::Path,
    error_fn: syn::Path,
}

impl<'a> MacroState<'a> {
    fn val(variant: &syn::Variant) -> Option<syn::Lit> {
        let val = variant
            .attrs
            .iter()
            .find(|a| a.path.get_ident().map(|i| i == "val").unwrap_or(false))
            .map(|a| a.tokens.to_string())?;
        let trimmed = val[1..].trim();
        syn::parse_str(trimmed).ok()
    }

    fn rust_type(sql_type: &syn::Ident) -> Result<syn::Ident, proc_macro2::TokenStream> {
        let name = match sql_type.to_string().as_str() {
            "SmallInt" => "i16",
            "Integer" | "Int" => "i32",
            "BigInt" => "i64",
            "VarChar" | "Text" => "String",
            _ => {
                let sql_types = "`SmallInt`, `Integer`, `Int`, `BigInt`, `VarChar`, `Text`";
                let message = format!(
                    "`sql_type` must be one of {}, but was {}",
                    sql_types, sql_type,
                );
                return Err(error(sql_type.span(), &message));
            }
        };
        let span = proc_macro2::Span::call_site();
        Ok(syn::Ident::new(name, span))
    }

    fn try_from(&self) -> proc_macro2::TokenStream {
        let variants = self.variants.iter().map(|f| &f.ident);
        let error_fn = &self.error_fn;
        let name_str = self.name.to_string();
        let name = &self.name;
        let rust_type = &self.rust_type;
        let conversion = match self.rust_type.to_string().as_str() {
            "i16" | "i32" | "i64" => {
                quote! {
                    const VARIANTS: &'static [#name] = &[#(#name::#variants),*];
                    for &variant in VARIANTS {
                        if variant as #rust_type == inp {
                            return Ok(variant);
                        }
                    }
                    Err(#error_fn(format!("Unexpected `{}`: {}", #name_str, inp)))
                }
            }
            "String" => {
                let span = proc_macro2::Span::call_site();
                let field_names = self.variants.iter().map(|v| {
                    use syn::{Lit::Str, LitStr};
                    let fallback = v.ident.to_string().to_lowercase();
                    Self::val(v).unwrap_or_else(|| Str(LitStr::new(&fallback, span)))
                });

                quote! {
                    match inp.as_str() {
                        #(#field_names => Ok(Self::#variants),)*
                        otherwise => {
                            Err(#error_fn(format!("Unexpected `{}`: {}", #name_str, otherwise)))
                        },
                    }
                }
            }
            _ => panic!(),
        };

        let error_type = &self.error_type;
        quote! {
            impl TryFrom<#rust_type> for #name {
                type Error = #error_type;

                fn try_from(inp: #rust_type) -> std::result::Result<Self, Self::Error> {
                    #conversion
                }
            }
        }
    }

    fn as_impl(&self) -> proc_macro2::TokenStream {
        let rust_type = &self.rust_type;
        let name = &self.name;
        let variants = self.variants.iter().map(|f| &f.ident);
        let conversion = match self.rust_type.to_string().as_str() {
            "i16" | "i32" | "i64" => {
                let variants = self.variants.iter().map(|f| &f.ident);
                quote! {
                    match self {
                        #(Self::#variants => Self::#variants as #rust_type,)*
                    }
                }
            }
            "String" => {
                let span = proc_macro2::Span::call_site();
                let field_names = self.variants.iter().map(|v| {
                    use syn::{Lit::Str, LitStr};
                    let fallback = v.ident.to_string().to_lowercase();
                    Self::val(v).unwrap_or_else(|| Str(LitStr::new(&fallback, span)))
                });

                quote! {
                    match self {
                        #(Self::#variants => #field_names,)*
                    }
                }
            }
            _ => panic!(),
        };

        quote! {
            impl Into<#rust_type> for #name {
                fn into(self) -> #rust_type {
                    #conversion.into()
                }
            }
        }
    }

    fn impl_for_from_sql(&self) -> proc_macro2::TokenStream {
        let sql_type = &self.sql_type;
        let rust_type = &self.rust_type;
        let name = &self.name;

        quote! {
            impl<Db> FromSql<#sql_type, Db> for #name
            where
                Db: diesel::backend::Backend,
                #rust_type: FromSql<#sql_type, Db>
            {
                fn from_sql(bytes: <Db as diesel::backend::Backend>::RawValue<'_>) -> deserialize::Result<Self> {
                    let s = <#rust_type as FromSql<#sql_type, Db>>::from_sql(bytes)?;
                    let v = s.try_into()?;
                    Ok(v)
                }
            }
        }
    }

    fn to_sql(&self) -> proc_macro2::TokenStream {
        let span = proc_macro2::Span::call_site();
        let sql_type = &self.sql_type;
        let rust_type = &self.rust_type;
        let rust_type_borrowed = if rust_type == "String" {
            quote! { str }
        } else {
            quote! { #rust_type }
        };
        let name = &self.name;
        let conversion = match self.rust_type.to_string().as_str() {
            "i16" | "i32" | "i64" => {
                let variants = self.variants.iter().map(|f| &f.ident);
                let values = self.variants.iter().map(|&v| {
                    let ident = &v.ident;
                    quote! {
                        (Self::#ident as #rust_type).to_sql(out)
                    }
                });

                quote! {
                    match self {
                        #(Self::#variants => #values,)*
                    }
                }
            }
            "String" => {
                let variants = self.variants.iter().map(|f| &f.ident);
                let field_names = self.variants.iter().map(|&v| {
                    use syn::{Lit::Str, LitStr};
                    let fallback = v.ident.to_string().to_lowercase();
                    let val = Self::val(v).unwrap_or_else(|| Str(LitStr::new(&fallback, span)));
                    quote! {
                        #val.to_sql(out)
                    }
                });

                quote! {
                    match self {
                        #(Self::#variants => #field_names,)*
                    }
                }
            }
            _ => panic!(),
        };

        quote! {
            impl<Db> ToSql<#sql_type, Db> for #name
            where
                Db: diesel::backend::Backend,
                #rust_type_borrowed: ToSql<#sql_type, Db>
            {
                fn to_sql<'b>(&'b self, out: &mut Output<'b, '_, Db>) -> serialize::Result {
                    #conversion
                }
            }
        }
    }
}

fn get_attr_ident(
    attrs: &[syn::Attribute],
    outer: &str,
    inner: &str,
) -> Result<syn::Ident, proc_macro2::TokenStream> {
    let stream = attrs
        .iter()
        .filter(|a| a.path.get_ident().map(|i| i == outer).unwrap_or(false))
        .map(|a| &a.tokens)
        .find(|s| s.to_string().contains(inner))
        .ok_or_else(|| {
            let span = proc_macro2::Span::call_site();
            let msg = format!(
                "Usage of the `DbEnum` macro requires the `{}` attribute to be present",
                outer
            );
            error(span, &msg)
        })?;
    let s = stream.to_string();
    let s = s
        .split('=')
        .nth(1)
        .ok_or_else(|| error(stream.span(), "malformed attribute"))?
        .trim_matches(|c| " )".contains(c));
    Ok(syn::Ident::new(s, stream.span()))
}

fn get_attr_path(
    attrs: &[syn::Attribute],
    outer: &str,
    inner: &str,
) -> Result<syn::Path, proc_macro2::TokenStream> {
    let stream = attrs
        .iter()
        .filter(|a| a.path.get_ident().map(|i| i == outer).unwrap_or(false))
        .map(|a| &a.tokens)
        .find(|s| s.to_string().contains(inner))
        .ok_or_else(|| {
            let span = proc_macro2::Span::call_site();
            let msg = format!(
                "Usage of the `DbEnum` macro requires the `{}` attribute to be present",
                outer
            );
            error(span, &msg)
        })?;
    let s = stream.to_string();
    let s = s
        .split('=')
        .nth(1)
        .ok_or_else(|| error(stream.span(), "malformed attribute"))?
        .trim_matches(|c| " )".contains(c));
    syn::parse_str(s).map_err(|_| error(stream.span(), "Invalid path"))
}

fn error(span: proc_macro2::Span, message: &str) -> proc_macro2::TokenStream {
    syn::Error::new(span, message).into_compile_error()
}

#[proc_macro_derive(DbEnum, attributes(diesel, diesel_enum))]
pub fn db_enum(input: proc_macro::TokenStream) -> proc_macro::TokenStream {
    let input = syn::parse_macro_input!(input as syn::DeriveInput);
    let name = input.ident;
    let sql_type = try_or_return!(get_attr_ident(&input.attrs, "diesel", "sql_type"));
    let error_fn = try_or_return!(get_attr_path(&input.attrs, "diesel_enum", "error_fn"));
    let error_type = try_or_return!(get_attr_path(&input.attrs, "diesel_enum", "error_type"));
    let rust_type = try_or_return!(MacroState::rust_type(&sql_type));
    let span = proc_macro2::Span::call_site();
    let data = match input.data {
        syn::Data::Enum(data) => data,
        _ => return error(span, "DbEnum should be called on an Enum").into(),
    };
    let variants = data.variants.iter().collect();
    let state = MacroState {
        name,
        variants,
        sql_type,
        rust_type,
        error_fn,
        error_type,
    };
    let impl_for_from_sql = state.impl_for_from_sql();
    let to_sql = state.to_sql();
    let try_from = state.try_from();
    let into = state.as_impl();
    let name = state.name;
    let mod_name = syn::Ident::new(
        &format!("__impl_db_enum_{}", name),
        proc_macro2::Span::call_site(),
    );
    let sql_type = state.sql_type;
    let error_type = state.error_type;
    let error_mod = state.error_fn.segments.first().expect("need `error_fn`");
    let error_type_str = error_type
        .segments
        .iter()
        .fold(String::new(), |a, b| a + &b.ident.to_string() + "::");
    let error_type_str = &error_type_str[..error_type_str.len() - 2];
    let error_import = if error_mod.ident == error_type_str {
        quote! {}
    } else {
        quote! { use super::#error_mod; }
    };

    (quote! {
        #[allow(non_snake_case, unused_extern_crates, unused_imports)]
        mod #mod_name {
            use super::{#name, #error_type};
            #error_import

            use diesel::{
                self,
                deserialize::{self, FromSql},
                serialize::{self, Output, ToSql},
                sql_types::#sql_type,
            };
            use std::{
                convert::{TryFrom, TryInto},
                io::Write,
            };

            #[automatically_derived]
            #impl_for_from_sql

            #[automatically_derived]
            #to_sql

            #[automatically_derived]
            #try_from

            #[automatically_derived]
            #into
        }
    })
    .into()
}
