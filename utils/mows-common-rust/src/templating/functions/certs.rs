use gtmpl::{FuncError, Value};
use rcgen::{
    BasicConstraints, Certificate, CertificateParams, DnType, ExtendedKeyUsagePurpose, IsCa,
    KeyPair, KeyUsagePurpose,
};
use std::collections::HashMap;
use time::OffsetDateTime;

pub fn gen_ca(args: &[Value]) -> Result<Value, FuncError> {
    let common_name = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    let common_name = common_name.to_string();

    let days = args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    let days = days.to_string();

    let (ca_cert, ca_keys) = new_ca(&common_name, &days)?;

    let mut result = HashMap::new();

    result.insert("Cert".to_string(), Value::from(ca_cert.pem()));
    result.insert("Key".to_string(), Value::from(ca_keys.serialize_pem()));

    Ok(gtmpl::Value::Map(result))
}

fn new_ca(common_name: &str, days: &str) -> anyhow::Result<(Certificate, KeyPair)> {
    let time_from_now = time::Duration::days(days.parse::<i64>()?);
    let mut params =
        CertificateParams::new(Vec::default()).expect("empty subject alt name can't produce error");
    let (from, until) = validity_period(time_from_now);
    params.is_ca = IsCa::Ca(BasicConstraints::Unconstrained);
    params
        .distinguished_name
        .push(DnType::CommonName, common_name.to_string());
    params
        .distinguished_name
        .push(DnType::OrganizationName, common_name.to_string());
    params.key_usages.push(KeyUsagePurpose::DigitalSignature);
    params.key_usages.push(KeyUsagePurpose::KeyCertSign);
    params.key_usages.push(KeyUsagePurpose::CrlSign);

    params.not_before = from;
    params.not_after = until;

    let key_pair = KeyPair::generate()?;

    Ok((params.self_signed(&key_pair)?, key_pair))
}

fn validity_period(duration_from_now: time::Duration) -> (OffsetDateTime, OffsetDateTime) {
    let now = OffsetDateTime::now_utc();
    let until = OffsetDateTime::now_utc()
        .checked_add(duration_from_now)
        .unwrap();
    (now, until)
}

pub fn gen_signed_cert(args: &[Value]) -> Result<Value, FuncError> {
    let common_name = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 5 arguments.".to_string(),
        5,
    ))?;
    let common_name = common_name.to_string();

    let ip_list = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 5 arguments.".to_string(),
        5,
    ))?;

    let ip_list = match ip_list {
        Value::Array(ips) => {
            let ips = ips.iter().map(|v| v.to_string()).collect::<Vec<String>>();
            Some(ips)
        }
        _ => None,
    };

    let dns_names = &args.get(2).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 5 arguments.".to_string(),
        5,
    ))?;

    let dns_names = match dns_names {
        Value::Array(dns_names) => {
            let dns_names = dns_names
                .iter()
                .map(|v| v.to_string())
                .collect::<Vec<String>>();
            Some(dns_names)
        }
        _ => None,
    };

    // concatenate the ips and dns_names into a string vec
    let alt_names = match (ip_list, dns_names) {
        (Some(ips), Some(mut dns_names)) => {
            let mut alt_names = ips;
            alt_names.append(&mut dns_names);
            alt_names
        }
        (Some(ips), None) => ips,
        (None, Some(dns_names)) => dns_names,
        (None, None) => vec![],
    };

    let days = &args.get(3).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 5 arguments.".to_string(),
        5,
    ))?;

    let days = days.to_string();

    let days = days
        .parse::<u32>()
        .map_err(|_| FuncError::Generic("Invalid number".to_string()))?;

    let ca = &args.get(4).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 5 arguments.".to_string(),
        5,
    ))?;

    let (ca_cert_pem, ca_key_pair_pem) = match ca {
        Value::Map(ca) => {
            let cert = ca
                .get("Cert")
                .ok_or(FuncError::Generic("No cert found".to_string()))?;
            let key = ca
                .get("Key")
                .ok_or(FuncError::Generic("No key found".to_string()))?;

            let cert = cert.to_string();
            let key = key.to_string();

            (cert, key)
        }
        _ => return Err(FuncError::Generic("Invalid CA".to_string())),
    };

    let mut own_cert_params: CertificateParams = rcgen::CertificateParams::new(alt_names)
        .map_err(|e| FuncError::Generic(format!("Error generating certificate params: {}", e)))?;

    own_cert_params.not_after = validity_period(time::Duration::days(days.into())).1;
    own_cert_params
        .distinguished_name
        .push(DnType::CommonName, common_name.clone());
    own_cert_params.use_authority_key_identifier_extension = true;
    own_cert_params
        .key_usages
        .push(KeyUsagePurpose::DigitalSignature);
    own_cert_params
        .extended_key_usages
        .push(ExtendedKeyUsagePurpose::ServerAuth);

    let ca_key_pair = rcgen::KeyPair::from_pem(&ca_key_pair_pem)
        .map_err(|e| FuncError::Generic(format!("Error generating key pair: {}", e.to_string())))?;

    let ca_cert_params = rcgen::CertificateParams::from_ca_cert_pem(&ca_cert_pem)
        .map_err(|e| FuncError::Generic(format!("Error generating certificate: {}", e)))?;

    let ca_cert = ca_cert_params
        .self_signed(&ca_key_pair)
        .map_err(|e| FuncError::Generic(format!("Error generating certificate: {}", e)))?;

    let own_key_pair = rcgen::KeyPair::generate()
        .map_err(|e| FuncError::Generic(format!("Error generating key pair: {}", e.to_string())))?;

    let cert = own_cert_params
        .signed_by(&own_key_pair, &ca_cert, &ca_key_pair)
        .map_err(|e| FuncError::Generic(format!("Error generating certificate: {}", e)))?;

    let mut result = HashMap::new();

    result.insert("Cert".to_string(), Value::from(cert.pem()));
    result.insert("Key".to_string(), Value::from(own_key_pair.serialize_pem()));

    Ok(gtmpl::Value::Map(result))
}

pub fn gen_self_signed_cert(args: &[Value]) -> Result<Value, FuncError> {
    let common_name = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 4 arguments.".to_string(),
        4,
    ))?;

    let common_name = common_name.to_string();

    let ips = &args.get(1).unwrap_or(&Value::Nil);

    let ips = match ips {
        Value::Array(ips) => {
            let ips = ips.iter().map(|v| v.to_string()).collect::<Vec<String>>();
            Some(ips)
        }
        _ => None,
    };

    let dns_names = &args.get(2).unwrap_or(&Value::Nil);

    let dns_names = match dns_names {
        Value::Array(dns_names) => {
            let dns_names = dns_names
                .iter()
                .map(|v| v.to_string())
                .collect::<Vec<String>>();
            Some(dns_names)
        }
        _ => None,
    };

    // concatenate the ips and dns_names into a string vec
    let alt_names = match (ips, dns_names) {
        (Some(ips), Some(mut dns_names)) => {
            let mut alt_names = ips;
            alt_names.append(&mut dns_names);
            alt_names
        }
        (Some(ips), None) => ips,
        (None, Some(dns_names)) => dns_names,
        (None, None) => vec![],
    };

    let days = &args.get(3).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 4 arguments.".to_string(),
        4,
    ))?;

    let days = days.to_string();

    let days = days
        .parse::<u32>()
        .map_err(|_| FuncError::Generic("Invalid number".to_string()))?;

    let mut cert_params: CertificateParams = rcgen::CertificateParams::new(alt_names)
        .map_err(|e| FuncError::Generic(format!("Error generating certificate params: {}", e)))?;

    cert_params.not_after = validity_period(time::Duration::days(days.into())).1;

    cert_params
        .distinguished_name
        .push(DnType::CommonName, common_name.clone());

    cert_params.use_authority_key_identifier_extension = true;

    cert_params
        .key_usages
        .push(KeyUsagePurpose::DigitalSignature);

    cert_params
        .extended_key_usages
        .push(ExtendedKeyUsagePurpose::ServerAuth);

    let key_pair = rcgen::KeyPair::generate()
        .map_err(|e| FuncError::Generic(format!("Error generating key pair: {}", e.to_string())))?;

    let cert = cert_params
        .self_signed(&key_pair)
        .map_err(|e| FuncError::Generic(format!("Error generating certificate: {}", e)))?;

    let cert = cert.pem();

    let key = key_pair.serialize_pem();

    let mut result = HashMap::new();

    result.insert("Cert".to_string(), Value::from(cert));
    result.insert("Key".to_string(), Value::from(key));

    Ok(gtmpl::Value::Map(result))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gen_self_signed_cert() {
        let result = gen_self_signed_cert(&[
            Value::String("foo.com".to_string()),
            Value::Array(vec![
                Value::String("10.0.0.1".to_string()),
                Value::String("10.0.0.2".to_string()),
            ]),
            Value::Array(vec![
                Value::String("bar.com".to_string()),
                Value::String("bat.com".to_string()),
            ]),
            Value::from(365),
        ])
        .unwrap();

        match result {
            Value::Map(map) => {
                let cert = map.get("Cert").unwrap().to_string();
                let key = map.get("Key").unwrap().to_string();
                assert!(cert.starts_with("-----BEGIN CERTIFICATE-----"));
                assert!(key.starts_with("-----BEGIN PRIVATE KEY-----"));
            }
            _ => panic!("Expected a map"),
        }
    }

    #[test]
    fn test_gen_ca() {
        let result = gen_ca(&[Value::String("foo.com".to_string()), Value::from(365)]).unwrap();

        match result {
            Value::Map(map) => {
                let cert = map.get("Cert").unwrap().to_string();
                let key = map.get("Key").unwrap().to_string();
                assert!(cert.starts_with("-----BEGIN CERTIFICATE-----"));
                assert!(key.starts_with("-----BEGIN PRIVATE KEY-----"));
            }
            _ => panic!("Expected a map"),
        }
    }

    #[test]
    fn test_gen_signed_cert() {
        // First generate a CA
        let ca = gen_ca(&[Value::String("test-ca".to_string()), Value::from(365)]).unwrap();

        // Then generate a signed cert
        let result = gen_signed_cert(&[
            Value::String("test.com".to_string()),
            Value::Array(vec![Value::String("127.0.0.1".to_string())]),
            Value::Array(vec![Value::String("test.com".to_string())]),
            Value::from(365),
            ca,
        ])
        .unwrap();

        match result {
            Value::Map(map) => {
                let cert = map.get("Cert").unwrap().to_string();
                let key = map.get("Key").unwrap().to_string();
                assert!(cert.starts_with("-----BEGIN CERTIFICATE-----"));
                assert!(key.starts_with("-----BEGIN PRIVATE KEY-----"));
            }
            _ => panic!("Expected a map"),
        }
    }
}
