// test gen_self_signed_cert

use core::hash;
use std::collections::HashMap;

use gtmpl::{Context as GtmplContext, Template, Value as GtmplValue};
use gtmpl_derive::Gtmpl;
use mows_common::templating::functions::TEMPLATE_FUNCTIONS;

#[derive(Gtmpl)]
struct LocalContext {
    variables: HashMap<String, GtmplValue>,
}

#[test]
fn test_gen_self_signed_cert() {
    let mut template_creator = Template::default();
    template_creator.add_funcs(&TEMPLATE_FUNCTIONS);

    let context = GtmplContext::from(LocalContext {
        variables: HashMap::new(),
    });

    let template = r#"
{{ $cert := genSelfSignedCert "foo.com" (list "10.0.0.1" "10.0.0.2") (list "bar.com" "bat.com") 365 }}
{{ toJson $cert }}


"#;

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
    template_creator.add_funcs(&TEMPLATE_FUNCTIONS);

    let context = GtmplContext::from(LocalContext {
        variables: HashMap::new(),
    });

    let template = r#"
{{ $json := fromJson "{\"foo\": \"bar\"}" }}
{{ toJson $json }}
"#;

    template_creator.parse(template).unwrap();

    let result = template_creator.render(&context).unwrap();

    assert_eq!(result.trim(), "{\"foo\":\"bar\"}");
}

#[test]
fn test_value_access_from_json() {
    let mut template_creator = Template::default();
    template_creator.add_funcs(&TEMPLATE_FUNCTIONS);

    let context = GtmplContext::from(LocalContext {
        variables: HashMap::new(),
    });

    let template = r#"
{{ $json := fromJson "{\"foo\": \"bar\"}" }}
{{ $json.foo }}
"#;

    template_creator.parse(template).unwrap();

    let result = template_creator.render(&context).unwrap();

    assert_eq!(result.trim(), "bar");
}

#[test]
fn test_value_access_from_json_without_variable() {
    let mut template_creator = Template::default();
    template_creator.add_funcs(&TEMPLATE_FUNCTIONS);

    let context = GtmplContext::from(LocalContext {
        variables: HashMap::new(),
    });

    let template = r#"
{{ (fromJson "{\"foo\": \"bar\"}").foo }}
"#;

    template_creator.parse(template).unwrap();

    let result = template_creator.render(&context).unwrap();

    assert_eq!(result.trim(), "bar");
}

#[test]
fn variables_work() {
    let mut template_creator = Template::default();
    template_creator.add_funcs(&TEMPLATE_FUNCTIONS);
    let mut variables = HashMap::new();
    variables.insert("foo".to_string(), GtmplValue::String("bar".to_string()));

    let context = GtmplContext::from(LocalContext { variables });

    let template = r#"{{ .variables.foo }}"#;

    template_creator.parse(template).unwrap();

    let result = template_creator.render(&context).unwrap();

    assert_eq!(result, "bar");
}

#[test]
fn test_trim() {
    let mut template_creator = Template::default();
    template_creator.add_funcs(&TEMPLATE_FUNCTIONS);
    let mut variables = HashMap::new();

    let multiline = r#"-----BEGIN CERTIFICATE-----
MIIBbjCCARSgAwIBAgIUUsAyLp9qn6FM3flE6wyCf6dIi20wCgYIKoZIzj0EAwIw
ITEfMB0GA1UEAwwWcmNnZW4gc2VsZiBzaWduZWQgY2VydDAgFw03NTAxMDEwMDAw
MDBaGA80MDk2MDEwMTAwMDAwMFowITEfMB0GA1UEAwwWcmNnZW4gc2VsZiBzaWdu
ZWQgY2VydDBZMBMGByqGSM49AgEGCCqGSM49AwEHA0IABGoK877ePyDs5B1+nXQo
Qo4EnVPRqGj84ht6mIrZF4JwAPa67MXLfsL6GRhjFW5FNYj9Rne7BSeMLU0OG5JC
IAajKDAmMCQGA1UdEQQdMBuCB3ppdGFkZWyCB3ppdGFkZWyCB3ppdGFkZWwwCgYI
KoZIzj0EAwIDSAAwRQIgLcqDHZpvt09CDxrFlOnwXpW7LolxQx2nAwAjAvDwaHEC
IQDSSxvE4LxzzFINETpZmR4iceGpGeqdnJge+hZn6kbW7A==
-----END CERTIFICATE-----"#;

    variables.insert(
        "cert".to_string(),
        GtmplValue::String(multiline.to_string()),
    );

    let context = GtmplContext::from(LocalContext { variables });

    let template = r#"{{ trim .variables.cert  }}"#;

    template_creator.parse(template).unwrap();

    let result = template_creator.render(&context).unwrap();

    assert_eq!(result, multiline);
}

#[test]
fn indent_works() {
    let mut template_creator = Template::default();
    template_creator.add_funcs(&TEMPLATE_FUNCTIONS);
    let mut variables = HashMap::new();

    let multiline = r#"123
abc
xyz"#;

    variables.insert(
        "multiline".to_string(),
        GtmplValue::String(multiline.to_string()),
    );

    let context = GtmplContext::from(LocalContext { variables });

    let template = r#"{{ .variables.multiline | indent 6 }}"#;

    template_creator.parse(template).unwrap();

    let result = template_creator.render(&context).unwrap();

    assert_eq!(result, "      123\n      abc\n      xyz");
}

#[test]
fn gen_ca_and_sign_cert() {
    let mut template_creator = Template::default();
    template_creator.add_funcs(&TEMPLATE_FUNCTIONS);

    let context = GtmplContext::from(LocalContext {
        variables: HashMap::new(),
    });

    let template = r#"
{{ $ca := genCA "foo.com" 365 }}

{{ toJson $ca }}
"#;

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
    template_creator.add_funcs(&TEMPLATE_FUNCTIONS);

    let context = GtmplContext::from(LocalContext {
        variables: HashMap::new(),
    });

    let template = r#"
{{ $ca := genCA "zitadel" 365 }}
{{ $cert := genSignedCert "zitadel" (list "zitadel") (list "zitadel") 365 $ca }}

{{ $out := dict "Cert" $cert.Cert "Key" $cert.Key "CaCert" $ca.Cert "CaKey" $ca.Key }}
{{ toJson $out }}

"#;

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
