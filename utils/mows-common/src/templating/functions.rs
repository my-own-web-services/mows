use core::str;
/// These functions aim to implement the list of functions available in Helm
/// https://helm.sh/docs/chart_template_guide/function_list/
use gtmpl::{Func, FuncError, Value};
use rand::Rng;
use sha1::Sha1;
use sha2::{Digest, Sha256, Sha512};
use std::collections::HashMap;
extern crate bcrypt;

//TODO turn unwraps into func errors where possible

use bcrypt::DEFAULT_COST;
pub const TEMPLATE_FUNCTIONS: [(&str, Func); 51] = [
    ("randomString", random_string as Func),
    ("hash", hash as Func),
    ("b64enc", b64enc as Func),
    ("b64dec", b64dec as Func),
    ("b32enc", b32enc as Func),
    ("b32dec", b32dec as Func),
    ("default", default as Func),
    ("empty", empty as Func),
    ("fail", fail as Func),
    ("coalesce", coalesce as Func),
    ("ternary", ternary as Func),
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
    ("contains", contains as Func),
    ("hasPrefix", has_prefix as Func),
    ("hasSuffix", has_suffix as Func),
    ("quote", quote as Func),
    ("squote", squote as Func),
    ("cat", cat as Func),
    ("indent", indent as Func),
    ("replace", replace as Func),
    ("plural", plural as Func),
    ("sha1sum", sha1sum as Func),
    ("sha256sum", sha256sum as Func),
    ("sha512sum", sha512sum as Func),
    ("md5sum", md5sum as Func),
    ("htpasswd", htpasswd as Func),
    ("joindomain", join_domain as Func),
    ("mul", math_multiply as Func),
    ("add", math_add as Func),
    ("sub", math_subtract as Func),
    ("div", math_divide as Func),
    ("mod", math_modulo as Func),
    ("pow", math_power as Func),
];

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
    let value = &args.first().ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let value = value.to_string();
    let indent = &args.get(1).ok_or(FuncError::ExactlyXArgs(
        "This function requires exactly 2 arguments.".to_string(),
        2,
    ))?;
    let indent = indent.to_string();
    let indent = indent
        .parse::<usize>()
        .map_err(|_| FuncError::Generic("Invalid number".to_string()))?;
    let indent_string = " ".repeat(indent);

    let mut result = String::new();
    let lines = value.split('\n');
    for line in lines {
        result.push_str(&indent_string);
        result.push_str(line);
        result.push('\n');
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

fn hash(args: &[Value]) -> Result<Value, FuncError> {
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

pub fn serde_json_hashmap_to_gtmpl_hashmap(
    hashmap: HashMap<String, serde_json::Value>,
) -> HashMap<String, Value> {
    let mut gtmpl_hashmap = HashMap::new();
    for (key, value) in hashmap {
        gtmpl_hashmap.insert(key, Value::from(serde_json_value_to_gtmpl_value(value)));
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
