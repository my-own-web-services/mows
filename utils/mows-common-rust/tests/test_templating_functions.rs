// Integration tests for template functions
//
// These tests verify that template functions work correctly when used through
// the template system.

use gtmpl_ng::all_functions::all_functions;
use gtmpl_ng::{Context as GtmplContext, Template, Value as GtmplValue};
use gtmpl_derive::Gtmpl;
use std::collections::HashMap;

#[derive(Gtmpl)]
struct LocalContext {
    variables: HashMap<String, GtmplValue>,
}

#[test]
fn test_gen_self_signed_cert() {
    let mut template_creator = Template::default();
    template_creator.add_funcs(&all_functions());

    let context = GtmplContext::from(LocalContext {
        variables: HashMap::new(),
    });

    let template = r#"{{ $cert := genSelfSignedCert "foo.com" (list "10.0.0.1" "10.0.0.2") (list "bar.com" "bat.com") 365 }}
{{ toJson $cert }}"#;

    template_creator.parse(template).unwrap();

    let result = template_creator.render(&context).unwrap();

    #[derive(Debug, serde::Deserialize)]
    #[serde(rename_all = "PascalCase")]

    pub struct Result {
        pub cert: String,
        pub key: String,
    }

    let result: Result = serde_json::from_str(&result).unwrap();

    assert_eq!(result.cert.starts_with("-----BEGIN CERTIFICATE-----"), true);
    assert_eq!(result.key.starts_with("-----BEGIN PRIVATE KEY-----"), true);
}
#[test]
fn test_from_json_to_json() {
    let mut template_creator = Template::default();
    template_creator.add_funcs(&all_functions());

    let context = GtmplContext::from(LocalContext {
        variables: HashMap::new(),
    });

    let template = r#"{{ $json := fromJson "{\"foo\": \"bar\"}" }}
{{ toJson $json }}"#;

    template_creator.parse(template).unwrap();

    let result = template_creator.render(&context).unwrap();

    assert_eq!(result.trim(), "{\"foo\":\"bar\"}");
}

#[test]
fn test_value_access_from_json() {
    let mut template_creator = Template::default();
    template_creator.add_funcs(&all_functions());

    let context = GtmplContext::from(LocalContext {
        variables: HashMap::new(),
    });

    let template = r#"{{ $json := fromJson "{\"foo\": \"bar\"}" }}
{{ $json.foo }}"#;

    template_creator.parse(template).unwrap();

    let result = template_creator.render(&context).unwrap();

    assert_eq!(result.trim(), "bar");
}

#[test]
fn test_value_access_from_json_without_variable() {
    let mut template_creator = Template::default();
    template_creator.add_funcs(&all_functions());

    let context = GtmplContext::from(LocalContext {
        variables: HashMap::new(),
    });

    let template = r#"{{ (fromJson "{\"foo\": \"bar\"}").foo }}"#;

    template_creator.parse(template).unwrap();

    let result = template_creator.render(&context).unwrap();

    assert_eq!(result.trim(), "bar");
}

#[test]
fn variables_work() {
    let mut template_creator = Template::default();
    template_creator.add_funcs(&all_functions());
    let mut variables = HashMap::new();
    variables.insert("foo".to_string(), GtmplValue::String("bar".to_string()));

    let context = GtmplContext::from(LocalContext { variables });

    let template = r#"{{ .variables.foo }}"#;

    template_creator.parse(template).unwrap();

    let result = template_creator.render(&context).unwrap();

    assert_eq!(result, "bar");
}


#[test]
fn gen_ca_and_sign_cert() {
    let mut template_creator = Template::default();
    template_creator.add_funcs(&all_functions());

    let context = GtmplContext::from(LocalContext {
        variables: HashMap::new(),
    });

    let template = r#"{{ $ca := genCA "foo.com" 365 }}
{{ toJson $ca }}"#;

    template_creator.parse(template).unwrap();

    let result = template_creator.render(&context).unwrap();

    #[derive(Debug, serde::Deserialize)]
    #[serde(rename_all = "PascalCase")]
    pub struct Result {
        pub cert: String,
        pub key: String,
    }

    let result: Result = serde_json::from_str(&result).unwrap();

    assert_eq!(result.cert.starts_with("-----BEGIN CERTIFICATE-----"), true);
    assert_eq!(result.key.starts_with("-----BEGIN PRIVATE KEY-----"), true);
}

#[test]
fn gen_signed_cert() {
    let mut template_creator = Template::default();
    template_creator.add_funcs(&all_functions());

    let context = GtmplContext::from(LocalContext {
        variables: HashMap::new(),
    });

    let template = r#"{{ $ca := genCA "zitadel" 365 }}
{{ $cert := genSignedCert "zitadel" (list "zitadel") (list "zitadel") 365 $ca }}

{{ $out := dict "Cert" $cert.Cert "Key" $cert.Key "CaCert" $ca.Cert "CaKey" $ca.Key }}
{{ toJson $out }}"#;

    template_creator.parse(template).unwrap();

    let result = template_creator.render(&context).unwrap();

    #[derive(Debug, serde::Deserialize)]
    #[serde(rename_all = "PascalCase")]
    pub struct Result {
        pub cert: String,
        pub key: String,
        pub ca_cert: String,
        pub ca_key: String,
    }

    let result: Result = serde_json::from_str(&result).unwrap();

    assert_eq!(result.cert.starts_with("-----BEGIN CERTIFICATE-----"), true);
    assert_eq!(result.key.starts_with("-----BEGIN PRIVATE KEY-----"), true);
    assert_eq!(
        result.ca_cert.starts_with("-----BEGIN CERTIFICATE-----"),
        true
    );
    assert_eq!(
        result.ca_key.starts_with("-----BEGIN PRIVATE KEY-----"),
        true
    );
}

