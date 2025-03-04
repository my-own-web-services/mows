use core::str;

use gtmpl::{Func, FuncError, Value};
use rand::Rng;
use rcgen::{
    BasicConstraints, Certificate, CertificateParams, DnType, ExtendedKeyUsagePurpose, IsCa,
    KeyPair, KeyUsagePurpose,
};
use sha1::Sha1;
use sha2::{Digest, Sha256, Sha512};
use std::collections::HashMap;
use time::OffsetDateTime;
extern crate bcrypt;

//TODO turn unwraps into func errors where possible

use bcrypt::DEFAULT_COST;
/// These functions aim to implement the list of functions available in Helm plus extra ones that may be useful.
/// https://helm.sh/docs/chart_template_guide/function_list/
pub const TEMPLATE_FUNCTIONS: [(&str, Func); 61] = [
    // and
    // or
    // not
    // eq
    // ne
    // lt
    // le
    // gt
    // ge
    ("default", default as Func),
    // required
    ("empty", empty as Func),
    ("fail", fail as Func),
    ("coalesce", coalesce as Func),
    ("ternary", ternary as Func),
    // print
    // println
    // printf
    ("trim", trim as Func),
    ("trimAll", trim_all as Func),
    ("trimPrefix", trim_prefix as Func),
    ("trimSuffix", trim_suffix as Func),
    ("lower", lower as Func),
    ("upper", upper as Func),
    ("title", title as Func),
    ("untitle", untitle as Func),
    ("repeat", repeat as Func),
    ("substr", substr as Func),
    ("nospace", nospace as Func),
    ("trunc", trunc as Func),
    ("abbrev", abbrev as Func),
    ("abbrevboth", abbrevboth as Func),
    ("initials", initials as Func),
    ("randAlpha", rand_alpha as Func),
    ("randNumeric", rand_numeric as Func),
    ("randAlphaNum", rand_alpha_num as Func),
    ("randAscii", rand_ascii as Func),
    // wrap
    // wrapWith
    ("contains", contains as Func),
    ("hasPrefix", has_prefix as Func),
    ("hasSuffix", has_suffix as Func),
    ("quote", quote as Func),
    ("squote", squote as Func),
    ("cat", cat as Func),
    ("indent", indent as Func),
    // nindent
    ("replace", replace as Func),
    ("plural", plural as Func),
    // snakecase
    // camelcase
    // kebabcase
    // swapcase
    // shuffle

    // atoi
    // float64
    // int
    // int64
    // toDecimal
    // toString
    // toStrings
    ("toJson", to_json as Func),
    ("toPrettyJson", to_pretty_json as Func),
    // toRawJson
    ("fromYaml", from_yaml as Func),
    ("fromJson", from_json as Func),
    // fromJsonArray
    ("toYaml", to_yaml as Func),
    // toToml
    // fromYamlArray

    // regexMatch
    // mustRegexMatch
    // regexFindAll
    // mustRegexFindAll
    // regexFind
    // mustRegexFind
    // regexReplaceAll
    // mustRegexReplaceAll
    // regexReplaceAllLiteral
    // mustRegexReplaceAllLiteral
    // regexSplit
    // mustRegexSplit
    ("sha1sum", sha1sum as Func),
    ("sha256sum", sha256sum as Func),
    ("sha512sum", sha512sum as Func),
    ("md5sum", md5sum as Func),
    ("htpasswd", htpasswd as Func),
    // derivePassword
    // genPrivateKey
    // buildCustomCert
    ("genCA", gen_ca as Func),
    ("genSelfSignedCert", gen_self_signed_cert as Func),
    ("genSignedCert", gen_signed_cert as Func),
    // encryptAES
    // decryptAES

    // now
    // ago
    // date
    // dateInZone
    // duration
    // durationRound
    // unixEpoch
    // dateModify
    // mustDateModify
    // htmlDate
    // htmlDateInZone
    // toDate
    // mustToDate
    ("dict", dict as Func),
    // get
    // set
    // unset
    // hasKey
    // pluck
    // dig
    // merge
    // mustMerge
    // mergeOverwrite
    // mustMergeOverwrite
    // keys
    // pick
    // omit
    // values
    // deepCopy
    // mustDeepCopy
    ("b64enc", b64enc as Func),
    ("b64dec", b64dec as Func),
    ("b32enc", b32enc as Func),
    ("b32dec", b32dec as Func),
    // first
    // mustFirst
    // rest
    // mustRest
    // last
    // mustLast
    // initial
    // mustInitial
    // append
    // mustAppend
    // prepend
    // mustPrepend
    // concat
    // reverse
    // mustReverse
    // uniq
    // mustUniq
    // without
    // mustWithout
    // has
    // mustHas
    // compact
    // mustCompact
    // index
    // slice
    // mustSlice
    // until
    // untilStep
    // seq
    ("add", math_add as Func),
    // add1
    ("sub", math_subtract as Func),
    ("div", math_divide as Func),
    ("mod", math_modulo as Func),
    ("mul", math_multiply as Func),
    // max
    // min
    // len
    // addf
    // add1f
    // subf
    // divf
    // mulf
    // maxf
    // minf
    // floor
    // ceil
    // round

    // getHostByName (WILL NOT BE IMPLEMENTED FOR SECURITY REASONS)

    // base
    // dir
    // clean
    // ext
    // isAbs

    // kindOf
    // kindIs
    // typeOf
    // typeIs
    // typeIsLike
    // deepEqual

    // semver
    // semverCompare

    // urlParse
    // urlJoin
    // urlQuery

    // uuidv4
    ("mowsRandomString", random_string as Func),
    ("mowsDigest", mows_digest as Func),
    ("mowsJoindomain", join_domain as Func),
    ("pow", math_power as Func),
    ("list", list as Func), // this is not mentioned in the helm docs but definitely present in helm
];

fn dict(args: &[Value]) -> Result<Value, FuncError> {
    let mut dict = HashMap::new();
    let mut args = args.iter();
    while let Some(key) = args.next() {
        let value = args
            .next()
            .ok_or(FuncError::Generic("No value found".to_string()))?;
        dict.insert(key.to_string(), value.clone());
    }
    Ok(Value::from(dict))
}

fn from_yaml(args: &[Value]) -> Result<Value, FuncError> {
    let value = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    let value = value.to_string();
    let value: serde_yaml::Value =
        serde_yaml::from_str(&value).map_err(|e| FuncError::Generic(e.to_string()))?;
    let value = serde_yaml_value_to_gtmpl_value(value);
    Ok(Value::from(value))
}

fn to_yaml(args: &[Value]) -> Result<Value, FuncError> {
    let value = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    let yaml =
        serde_yaml::to_string(&gtmpl_value_to_serde_yaml_value(value).map_err(|e| {
            FuncError::Generic(format!("Error converting to yaml: {}", e.to_string()))
        })?)
        .map_err(|e| FuncError::Generic(e.to_string()))?;

    Ok(Value::String(yaml))
}

fn from_json(args: &[Value]) -> Result<Value, FuncError> {
    let value = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    let value = value.to_string();
    let value: serde_json::Value =
        serde_json::from_str(&value).map_err(|e| FuncError::Generic(e.to_string()))?;
    let value = serde_json_value_to_gtmpl_value(value);
    Ok(Value::from(value))
}

fn to_json(args: &[Value]) -> Result<Value, FuncError> {
    let value = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    let json =
        serde_json::to_string(&gtmpl_value_to_serde_json_value(value).map_err(|e| {
            FuncError::Generic(format!("Error converting to json: {}", e.to_string()))
        })?)
        .map_err(|e| FuncError::Generic(e.to_string()))?;

    Ok(Value::String(json))
}

fn to_pretty_json(args: &[Value]) -> Result<Value, FuncError> {
    let value = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    let json =
        serde_json::to_string_pretty(&gtmpl_value_to_serde_json_value(value).map_err(|e| {
            FuncError::Generic(format!("Error converting to json: {}", e.to_string()))
        })?)
        .map_err(|e| FuncError::Generic(e.to_string()))?;

    Ok(Value::String(json))
}

fn list(args: &[Value]) -> Result<Value, FuncError> {
    Ok(Value::Array(args.to_vec()))
}

fn gen_ca(args: &[Value]) -> Result<Value, FuncError> {
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

    let mut cert_params: CertificateParams =
        rcgen::CertificateParams::new(vec![common_name.clone()]).map_err(|e| {
            FuncError::Generic(format!("Error generating certificate params: {}", e))
        })?;

    cert_params.is_ca = rcgen::IsCa::Ca(rcgen::BasicConstraints::Unconstrained);

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

fn gen_signed_cert(args: &[Value]) -> Result<Value, FuncError> {
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

fn gen_self_signed_cert(args: &[Value]) -> Result<Value, FuncError> {
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

//TODO the math functions may take multiple arguments

fn math_multiply(args: &[Value]) -> Result<Value, FuncError> {
    let a = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let b = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    let a = a
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    let b = b
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    Ok(Value::String((a * b).to_string()))
}

fn math_add(args: &[Value]) -> Result<Value, FuncError> {
    let a = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let b = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    let a = a
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    let b = b
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    Ok(Value::String((a + b).to_string()))
}
fn math_subtract(args: &[Value]) -> Result<Value, FuncError> {
    let a = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let b = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    let a = a
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    let b = b
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    Ok(Value::String((a - b).to_string()))
}
fn math_divide(args: &[Value]) -> Result<Value, FuncError> {
    let a = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let b = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    let a = a
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    let b = b
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    Ok(Value::String((a / b).to_string()))
}
fn math_modulo(args: &[Value]) -> Result<Value, FuncError> {
    let a = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let b = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    let a = a
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    let b = b
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    Ok(Value::String((a % b).to_string()))
}
fn math_power(args: &[Value]) -> Result<Value, FuncError> {
    let a = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments".to_string(),
        2,
    ))?;
    let b = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    let a = a
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    let b = b
        .to_string()
        .parse::<f64>()
        .map_err(|_| FuncError::UnableToConvertFromValue)?;

    Ok(Value::String((a.powf(b)).to_string()))
}
/// Join a domain and a subdomain together, joindomain "example.com" "www" -> "www.example.com"
fn join_domain(args: &[Value]) -> Result<Value, FuncError> {
    let domain = args.first().ok_or(FuncError::AtLeastXArgs(
        "This function requires at least 1 argument.".to_string(),
        1,
    ))?;
    let maybe_subdomain = args.get(1).unwrap_or(&Value::Nil);

    if maybe_subdomain.to_string().is_empty() || maybe_subdomain == &Value::Nil {
        Ok(domain.clone())
    } else {
        Ok(Value::String(format!("{maybe_subdomain}.{domain}")))
    }
}

fn default(args: &[Value]) -> Result<Value, FuncError> {
    let default = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let value = args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    if value_is_truthy(value) {
        Ok(default.clone())
    } else {
        Ok(value.clone())
    }
}

fn empty(args: &[Value]) -> Result<Value, FuncError> {
    let value = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    Ok(Value::Bool(value_is_truthy(value)))
}

fn fail(args: &[Value]) -> Result<Value, FuncError> {
    let value = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    Err(FuncError::Generic(value.to_string()))
}

fn coalesce(args: &[Value]) -> Result<Value, FuncError> {
    for arg in args.iter() {
        if !value_is_truthy(arg) {
            return Ok(arg.clone());
        }
    }
    Ok(Value::NoValue)
}

fn ternary(args: &[Value]) -> Result<Value, FuncError> {
    let if_true = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;
    let if_false = args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;
    let condition = args.get(2).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;

    if value_is_truthy(condition) {
        Ok(if_false.clone())
    } else {
        Ok(if_true.clone())
    }
}

fn trim(args: &[Value]) -> Result<Value, FuncError> {
    let value = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    let value = value.to_string();
    let value = value.trim();
    Ok(Value::from(value))
}

fn trim_all(args: &[Value]) -> Result<Value, FuncError> {
    let character = args
        .first()
        .ok_or(FuncError::ExactlyXArgs(
            "This function requires exactly 2 arguments.".to_string(),
            2,
        ))?
        .to_string();
    let value = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let character = character
        .chars()
        .next()
        .ok_or(FuncError::Generic("Invalid character".to_string()))?;
    let value = value.to_string();
    let value = value.trim_matches(character);
    Ok(Value::from(value))
}

fn trim_prefix(args: &[Value]) -> Result<Value, FuncError> {
    let arg0 = args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let prefix = arg0.to_string();
    let value = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let value = value.to_string();
    let value = value.trim_start_matches(&prefix);
    Ok(Value::from(value))
}

fn trim_suffix(args: &[Value]) -> Result<Value, FuncError> {
    let arg0 = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let suffix = arg0.to_string();
    let value = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let value = value.to_string();
    let value = value.trim_end_matches(&suffix);
    Ok(Value::from(value))
}

fn lower(args: &[Value]) -> Result<Value, FuncError> {
    let value = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    let value = value.to_string();
    let value = value.to_lowercase();
    Ok(Value::from(value))
}

fn upper(args: &[Value]) -> Result<Value, FuncError> {
    let value = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    let value = value.to_string();
    let value = value.to_uppercase();
    Ok(Value::from(value))
}

fn title(args: &[Value]) -> Result<Value, FuncError> {
    let value = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    let value = value.to_string();

    let words = value.split_whitespace();
    let mut result = String::new();
    for word in words {
        let mut chars = word.chars();
        let mut first_char = chars.next().ok_or(FuncError::Generic(
            "Invalid word. Word must have at least one character".to_string(),
        ))?;
        first_char = first_char.to_uppercase().next().ok_or(FuncError::Generic(
            "Invalid word. Word must have at least one character".to_string(),
        ))?;
        result.push(first_char);
        for kar in chars {
            result.push(kar);
        }
        result.push(' ');
    }

    Ok(Value::from(value))
}

fn untitle(args: &[Value]) -> Result<Value, FuncError> {
    let value = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    let value = value.to_string();

    let words = value.split_whitespace();
    let mut result = String::new();
    for word in words {
        let mut chars = word.chars();
        let mut first_char = chars.next().ok_or(FuncError::Generic(
            "Invalid word. Word must have at least one character".to_string(),
        ))?;
        first_char = first_char.to_lowercase().next().ok_or(FuncError::Generic(
            "Invalid word. Word must have at least one character".to_string(),
        ))?;
        result.push(first_char);
        for kar in chars {
            result.push(kar);
        }
        result.push(' ');
    }

    Ok(Value::from(value))
}

fn repeat(args: &[Value]) -> Result<Value, FuncError> {
    let times = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let value = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let value = value.to_string();
    let times = times.to_string();
    let times = times
        .parse::<usize>()
        .map_err(|_| FuncError::Generic("Invalid number".to_string()))?;
    let value = value.repeat(times);
    Ok(Value::from(value))
}

fn substr(args: &[Value]) -> Result<Value, FuncError> {
    let start = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;
    let start = start.to_string();
    let start = start
        .parse::<usize>()
        .map_err(|_| FuncError::Generic("Invalid number".to_string()))?;
    let end = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;
    let end = end.to_string();
    let end = end
        .parse::<usize>()
        .map_err(|_| FuncError::Generic("Invalid number".to_string()))?;
    let value = &args.get(2).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;
    let value = value.to_string();
    let value = &value[start..end];
    Ok(Value::from(value))
}

fn nospace(args: &[Value]) -> Result<Value, FuncError> {
    let value = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    let value = value.to_string();
    let value = value.replace(' ', "");
    Ok(Value::from(value))
}

fn trunc(args: &[Value]) -> Result<Value, FuncError> {
    let trunc_index = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let trunc_index = trunc_index.to_string();
    let negative = trunc_index.starts_with('-');
    let trunc_index = trunc_index.parse::<usize>().map_err(|_| {
        FuncError::Generic("Invalid number. Number must be a positive integer".to_string())
    })?;
    let value = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let mut value = value.to_string();

    if negative {
        value = String::from(&value[value.len() - trunc_index..]);
    } else {
        value = String::from(&value[..trunc_index]);
    }

    Ok(Value::from(value))
}

fn abbrev(args: &[Value]) -> Result<Value, FuncError> {
    let max_length = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let max_length = max_length.to_string();
    let max_length = max_length.parse::<usize>().map_err(|_| {
        FuncError::Generic("Invalid number. Number must be a positive integer".to_string())
    })?;

    let value = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let mut value = value.to_string();

    value = String::from(&value[..max_length - 3]);
    value.push_str("...");
    Ok(Value::from(value))
}

fn abbrevboth(args: &[Value]) -> Result<Value, FuncError> {
    let left_offset = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;
    let left_offset = left_offset.to_string();
    let left_offset = left_offset.parse::<usize>().map_err(|_| {
        FuncError::Generic("Invalid number. Number must be a positive integer".to_string())
    })?;

    let max_length = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;
    let max_length = max_length.to_string();
    let max_length = max_length.parse::<usize>().map_err(|_| {
        FuncError::Generic("Invalid number. Number must be a positive integer".to_string())
    })?;

    let value = &args.get(2).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;
    let value = value.to_string();

    let mut out = String::from("...");
    out.push_str(&value[left_offset..max_length - 3]);

    out.push_str("...");
    Ok(Value::from(out))
}

fn initials(args: &[Value]) -> Result<Value, FuncError> {
    let value = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    let value = value.to_string();
    let words = value.split_whitespace();
    let mut result = String::new();
    for word in words {
        let mut chars = word.chars();
        let mut first_char = chars.next().ok_or(FuncError::Generic(
            "Invalid word. Word must have at least one character".to_string(),
        ))?;
        first_char = first_char.to_uppercase().next().ok_or(FuncError::Generic(
            "Invalid word. Word must have at least one character".to_string(),
        ))?;
        result.push(first_char);
    }
    Ok(Value::from(result))
}

fn rand_alpha(args: &[Value]) -> Result<Value, FuncError> {
    let length = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    let length = length.to_string();
    let length = length
        .parse::<usize>()
        .map_err(|_| FuncError::Generic("Invalid number".to_string()))?;
    let mut rng = rand::thread_rng();

    let charset: Vec<u8> = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".to_vec();

    let generated: String = (0..length)
        .map(|_| {
            let idx = rng.gen_range(0..charset.len());
            *charset.get(idx).unwrap() as char
        })
        .collect();
    Ok(Value::from(generated))
}

fn rand_numeric(args: &[Value]) -> Result<Value, FuncError> {
    let length = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    let length = length.to_string();
    let length = length
        .parse::<usize>()
        .map_err(|_| FuncError::Generic("Invalid number".to_string()))?;
    let mut rng = rand::thread_rng();

    let charset: Vec<u8> = b"0123456789".to_vec();

    let generated: String = (0..length)
        .map(|_| {
            let idx = rng.gen_range(0..charset.len());
            *charset.get(idx).unwrap() as char
        })
        .collect();
    Ok(Value::from(generated))
}

fn rand_alpha_num(args: &[Value]) -> Result<Value, FuncError> {
    let length = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    let length = length.to_string();
    let length = length
        .parse::<usize>()
        .map_err(|_| FuncError::Generic("Invalid number".to_string()))?;
    let mut rng = rand::thread_rng();

    let charset: Vec<u8> =
        b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".to_vec();

    let generated: String = (0..length)
        .map(|_| {
            let idx = rng.gen_range(0..charset.len());
            *charset.get(idx).unwrap() as char
        })
        .collect();
    Ok(Value::from(generated))
}

fn rand_ascii(args: &[Value]) -> Result<Value, FuncError> {
    let length = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    let length = length.to_string();
    let length = length
        .parse::<usize>()
        .map_err(|_| FuncError::Generic("Invalid number".to_string()))?;
    let mut rng = rand::thread_rng();

    let charset: Vec<u8> =
        b" !#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~"
            .to_vec();

    let generated: String = (0..length)
        .map(|_| {
            let idx = rng.gen_range(0..charset.len());
            *charset.get(idx).unwrap() as char
        })
        .collect();
    Ok(Value::from(generated))
}

// TODO wrap
// TODO wrapWith
// https://helm.sh/docs/chart_template_guide/function_list/#contains

fn contains(args: &[Value]) -> Result<Value, FuncError> {
    let needle = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let needle = needle.to_string();
    let haystack = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let haystack = haystack.to_string();
    let result = haystack.contains(&needle);
    Ok(Value::from(result))
}

fn has_prefix(args: &[Value]) -> Result<Value, FuncError> {
    let prefix = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let prefix = prefix.to_string();
    let value = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let value = value.to_string();
    let result = value.starts_with(&prefix);
    Ok(Value::from(result))
}

fn has_suffix(args: &[Value]) -> Result<Value, FuncError> {
    let suffix = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let suffix = suffix.to_string();
    let value = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let value = value.to_string();
    let result = value.ends_with(&suffix);
    Ok(Value::from(result))
}

fn quote(args: &[Value]) -> Result<Value, FuncError> {
    let value = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    let value = value.to_string();
    let mut result = String::new();
    result.push('"');
    result.push_str(&value);
    result.push('"');
    Ok(Value::from(result))
}

fn squote(args: &[Value]) -> Result<Value, FuncError> {
    let value = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    let value = value.to_string();
    let mut result = String::new();
    result.push('\'');
    result.push_str(&value);
    result.push('\'');
    Ok(Value::from(result))
}

fn cat(args: &[Value]) -> Result<Value, FuncError> {
    let mut result = String::new();
    for arg in args {
        let arg = arg.to_string();
        result.push_str(&arg);

        result.push(' ');
    }
    result.pop();
    Ok(Value::from(result))
}

fn indent(args: &[Value]) -> Result<Value, FuncError> {
    // first argument is the indent number
    let indent = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    let indent = indent.to_string();

    let indent = indent
        .parse::<usize>()
        .map_err(|_| FuncError::Generic("Invalid number".to_string()))?;

    // second argument is the value to indent

    let value = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    let value = value.to_string();

    let indent_string = " ".repeat(indent);

    let mut result = String::new();
    let lines = value.split('\n');
    let line_count = lines.clone().count();
    for (index, line) in lines.enumerate() {
        result.push_str(&indent_string);
        result.push_str(line);

        if index != line_count - 1 {
            result.push('\n');
        }
    }
    Ok(Value::from(result))
}

// TODO nindent

fn replace(args: &[Value]) -> Result<Value, FuncError> {
    let old = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;
    let old = old.to_string();
    let new = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;
    let new = new.to_string();
    let value = &args.get(2).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;
    let value = value.to_string();
    let result = value.replace(&old, &new);
    Ok(Value::from(result))
}

fn plural(args: &[Value]) -> Result<Value, FuncError> {
    let singular = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;
    let singular = singular.to_string();
    let plural = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;
    let plural = plural.to_string();
    let length = &args.get(2).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 3 arguments.".to_string(),
        3,
    ))?;
    let length = length.to_string();
    let length = length
        .parse::<usize>()
        .map_err(|_| FuncError::Generic("Invalid number".to_string()))?;

    let result = if length == 1 { singular } else { plural };
    Ok(Value::from(result))
}

// TODO snakecase
// TODO camelcase
// TODO kebabcase
// TODO swapcase
// TODO shuffle

fn sha1sum(args: &[Value]) -> Result<Value, FuncError> {
    let to_be_hashed = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    let to_be_hashed = to_be_hashed.to_string();
    let to_be_hashed = to_be_hashed.as_bytes();

    let digest = Sha1::digest(to_be_hashed);

    let digest_hex_string = format!("{:x}", digest);

    Ok(Value::from(digest_hex_string))
}

fn sha256sum(args: &[Value]) -> Result<Value, FuncError> {
    let to_be_hashed = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    let to_be_hashed = to_be_hashed.to_string();

    let to_be_hashed = to_be_hashed.as_bytes();
    // hash with sha2 crate
    let digest = Sha256::digest(to_be_hashed);

    let digest_hex_string = format!("{:x}", digest);

    Ok(Value::from(digest_hex_string))
}

fn sha512sum(args: &[Value]) -> Result<Value, FuncError> {
    let to_be_hashed = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    let to_be_hashed = to_be_hashed.to_string();
    let to_be_hashed = to_be_hashed.as_bytes();

    let digest = Sha512::digest(to_be_hashed);

    let digest_hex_string = format!("{:x}", digest);

    Ok(Value::from(digest_hex_string))
}

fn md5sum(args: &[Value]) -> Result<Value, FuncError> {
    let to_be_hashed = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;

    let to_be_hashed = to_be_hashed.to_string();

    Ok(Value::from(format!(
        "{:x}",
        md5::compute(to_be_hashed.as_bytes())
    )))
}

// TODO adler32sum

fn htpasswd(args: &[Value]) -> Result<Value, FuncError> {
    let username = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let username = username.to_string();
    let password = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let password = password.to_string();

    let hashed = bcrypt::hash(password, DEFAULT_COST)
        .map_err(|_| FuncError::Generic("Invalid password".to_string()))?;
    Ok(Value::from(format!("{}:{}", username, hashed)))
}

fn b64enc(args: &[Value]) -> Result<Value, FuncError> {
    let content = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    let content = content.to_string();
    Ok(Value::from(
        data_encoding::BASE64.encode(content.as_bytes()),
    ))
}

fn b64dec(args: &[Value]) -> Result<Value, FuncError> {
    let content = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    let content = content.to_string();
    Ok(Value::from(
        str::from_utf8(
            &data_encoding::BASE64
                .decode(content.as_bytes())
                .map_err(|_| FuncError::Generic("Invalid base64 string".to_string()))?,
        )
        .map_err(|_| FuncError::Generic("Invalid base64 string".to_string()))?,
    ))
}

fn b32enc(args: &[Value]) -> Result<Value, FuncError> {
    let content = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    let content = content.to_string();
    Ok(Value::from(
        data_encoding::BASE32.encode(content.as_bytes()),
    ))
}

fn b32dec(args: &[Value]) -> Result<Value, FuncError> {
    let content = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 1 argument.".to_string(),
        1,
    ))?;
    let content = content.to_string();
    Ok(Value::from(
        str::from_utf8(
            &data_encoding::BASE32
                .decode(content.as_bytes())
                .map_err(|_| FuncError::Generic("Invalid base32 string".to_string()))?,
        )
        .map_err(|_| FuncError::Generic("Invalid base32 string".to_string()))?,
    ))
}

fn mows_digest(args: &[Value]) -> Result<Value, FuncError> {
    let method = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let method = method.to_string();

    let to_be_hashed = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let to_be_hashed = to_be_hashed.to_string();
    let to_be_hashed = to_be_hashed.as_bytes();

    let hash = match method.as_str() {
        "MD5" => {
            let digest = md5::compute(to_be_hashed).to_ascii_lowercase();
            str::from_utf8(&digest)
                .map_err(|_| FuncError::Generic("Invalid hash".to_string()))?
                .to_string()
        }
        "SHA1" => {
            let digest = Sha1::digest(to_be_hashed);
            str::from_utf8(digest.as_slice())
                .map_err(|_| FuncError::Generic("Invalid hash".to_string()))?
                .to_string()
        }
        "SHA256" => {
            let digest = Sha256::digest(to_be_hashed);
            str::from_utf8(digest.as_slice())
                .map_err(|_| FuncError::Generic("Invalid hash".to_string()))?
                .to_string()
        }
        "SHA512" => {
            let digest = Sha512::digest(to_be_hashed);
            str::from_utf8(digest.as_slice())
                .map_err(|_| FuncError::Generic("Invalid hash".to_string()))?
                .to_string()
        }
        _ => return Err(FuncError::Generic("Invalid hash method".to_string())),
    };

    Ok(Value::from(hash))
}

fn random_string(args: &[Value]) -> Result<Value, FuncError> {
    let method = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let method = method.to_string();

    let length = args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;

    let length = length.to_string().replace(' ', "").parse::<u16>().unwrap();

    let mut charset: Vec<u8> = b"".to_vec();
    if method.contains('A') {
        charset.extend(b"ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    }
    if method.contains('a') {
        charset.extend(b"abcdefghijklmnopqrstuvwxyz");
    }
    if method.contains('0') {
        charset.extend(b"0123456789");
    }
    if method.contains('%') {
        charset.extend(b"%!@#$%^&*()_+-=[]{}|;':,./<>?`~");
    }
    let mut rng = rand::thread_rng();

    let generated: String = (0..length)
        .map(|_| {
            let idx = rng.gen_range(0..charset.len());
            *charset.get(idx).unwrap() as char
        })
        .collect();

    Ok(Value::from(generated))
}

pub fn gtmpl_value_to_serde_yaml_value(value: &Value) -> anyhow::Result<serde_yaml::Value> {
    Ok(match value {
        Value::Nil => serde_yaml::Value::Null,
        Value::Bool(b) => serde_yaml::Value::Bool(*b),
        Value::Number(n) => {
            let number = n
                .as_f64()
                .ok_or(anyhow::anyhow!("Cannot convert number to YAML"))?;

            serde_yaml::Value::Number(number.into())
        }
        Value::String(s) => serde_yaml::Value::String(s.clone()),
        Value::Array(a) => {
            let mut array = Vec::new();
            for v in a {
                array.push(gtmpl_value_to_serde_yaml_value(v)?);
            }
            serde_yaml::Value::Sequence(array)
        }
        Value::Object(o) => {
            let mut object = serde_yaml::Mapping::new();
            for (k, v) in o {
                let key = serde_yaml::Value::String(k.clone());
                object.insert(key, gtmpl_value_to_serde_yaml_value(v)?);
            }
            serde_yaml::Value::Mapping(object)
        }
        Value::Map(m) => {
            let mut object = serde_yaml::Mapping::new();
            for (k, v) in m {
                let key = serde_yaml::Value::String(k.clone());
                object.insert(key, gtmpl_value_to_serde_yaml_value(v)?);
            }
            serde_yaml::Value::Mapping(object)
        }
        Value::Function(_) => serde_yaml::Value::Null,
        Value::NoValue => serde_yaml::Value::Null,
    })
}

pub fn gtmpl_value_to_serde_json_value(value: &Value) -> anyhow::Result<serde_json::Value> {
    Ok(match value {
        Value::Nil => serde_json::Value::Null,
        Value::Bool(b) => serde_json::Value::Bool(*b),
        Value::Number(n) => {
            let number = n
                .as_f64()
                .ok_or(anyhow::anyhow!("Cannot convert number to JSON"))?;
            serde_json::Value::Number(
                serde_json::Number::from_f64(number)
                    .ok_or(anyhow::anyhow!("Cannot convert number to JSON"))?,
            )
        }
        Value::String(s) => serde_json::Value::String(s.clone()),
        Value::Array(a) => {
            let mut array = Vec::new();
            for v in a {
                array.push(gtmpl_value_to_serde_json_value(v)?);
            }
            serde_json::Value::Array(array)
        }
        Value::Object(o) => {
            let mut object = serde_json::Map::new();
            for (k, v) in o {
                object.insert(k.clone(), gtmpl_value_to_serde_json_value(v)?);
            }
            serde_json::Value::Object(object)
        }
        Value::Map(m) => {
            let mut object = serde_json::Map::new();
            for (k, v) in m {
                object.insert(k.clone(), gtmpl_value_to_serde_json_value(v)?);
            }
            serde_json::Value::Object(object)
        }
        Value::Function(_) => return Err(anyhow::anyhow!("Cannot convert function to JSON")),
        Value::NoValue => serde_json::Value::Null,
    })
}

pub fn serde_json_hashmap_to_gtmpl_hashmap(
    hashmap: &HashMap<String, serde_json::Value>,
) -> HashMap<String, Value> {
    let mut gtmpl_hashmap = HashMap::new();
    for (key, value) in hashmap {
        gtmpl_hashmap.insert(
            key.to_string(),
            Value::from(serde_json_value_to_gtmpl_value(value.clone())),
        );
    }
    gtmpl_hashmap
}

pub fn serde_json_value_to_gtmpl_value(value: serde_json::Value) -> Value {
    match value {
        serde_json::Value::Null => Value::Nil,
        serde_json::Value::Bool(b) => Value::Bool(b),
        serde_json::Value::Number(n) => Value::Number(n.as_f64().unwrap().into()),
        serde_json::Value::String(s) => Value::String(s),
        serde_json::Value::Array(a) => {
            Value::Array(a.into_iter().map(serde_json_value_to_gtmpl_value).collect())
        }
        serde_json::Value::Object(o) => Value::Object(
            o.into_iter()
                .map(|(k, v)| (k, serde_json_value_to_gtmpl_value(v)))
                .collect(),
        ),
    }
}

pub fn serde_yaml_hashmap_to_gtmpl_hashmap(
    hashmap: HashMap<String, serde_yaml::Value>,
) -> HashMap<String, Value> {
    let mut gtmpl_hashmap = HashMap::new();
    for (key, value) in hashmap {
        gtmpl_hashmap.insert(key, Value::from(serde_yaml_value_to_gtmpl_value(value)));
    }
    gtmpl_hashmap
}

pub fn serde_yaml_value_to_gtmpl_value(value: serde_yaml::Value) -> Value {
    match value {
        serde_yaml::Value::Null => Value::Nil,
        serde_yaml::Value::Bool(b) => Value::Bool(b),
        serde_yaml::Value::Number(n) => Value::Number(n.as_f64().unwrap().into()),
        serde_yaml::Value::String(s) => Value::String(s),
        serde_yaml::Value::Sequence(a) => {
            Value::Array(a.into_iter().map(serde_yaml_value_to_gtmpl_value).collect())
        }
        serde_yaml::Value::Mapping(serde_mapping) => Value::Object({
            let mut gtmpl_object: HashMap<String, Value> = HashMap::new();
            for (key, value) in serde_mapping {
                gtmpl_object.insert(
                    serde_yaml_value_to_gtmpl_value(key).to_string(),
                    serde_yaml_value_to_gtmpl_value(value),
                );
            }
            gtmpl_object
        }),
        _ => unreachable!(),
    }
}

pub fn value_is_truthy(value: &Value) -> bool {
    match value {
        Value::Array(a) => a.is_empty(),
        Value::NoValue => true,
        Value::Nil => true,
        Value::Bool(b) => b == &false,
        Value::String(s) => s.is_empty(),
        Value::Object(o) => o.is_empty(),
        Value::Map(m) => m.is_empty(),
        Value::Function(_) => false,
        Value::Number(n) => n.as_f64().unwrap() == 0.0,
    }
}
