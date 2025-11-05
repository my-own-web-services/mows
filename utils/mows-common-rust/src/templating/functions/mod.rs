/// Template functions organized into modules for better maintainability
///
/// These functions aim to implement the list of functions available in Helm plus extra ones that may be useful.
/// https://helm.sh/docs/chart_template_guide/function_list/

pub mod certs;
pub mod conversion;
pub mod crypto;
pub mod dicts;
pub mod encoding;
pub mod lists;
pub mod logic;
pub mod math;
pub mod misc;
pub mod paths;
pub mod regex;
pub mod string;
pub mod types;
pub mod utils;

use gtmpl::Func;

// Re-export commonly used conversion functions for backward compatibility
pub use conversion::{
    gtmpl_value_to_serde_json_value, gtmpl_value_to_serde_yaml_value,
    serde_json_hashmap_to_gtmpl_hashmap, serde_json_value_to_gtmpl_value,
    serde_yaml_hashmap_to_gtmpl_hashmap, serde_yaml_value_to_gtmpl_value,
};

// Re-export value_is_truthy for backward compatibility
pub use logic::value_is_truthy;

/// All available template functions
///
/// This array contains all the template functions that can be used in templates.
/// Functions are organized by category in separate modules for better maintainability.
pub const TEMPLATE_FUNCTIONS: [(&str, Func); 155] = [
    // Logic functions
    ("default", logic::default as Func),
    ("empty", logic::empty as Func),
    ("fail", logic::fail as Func),
    ("coalesce", logic::coalesce as Func),
    ("ternary", logic::ternary as Func),
    // String manipulation functions
    ("trim", string::trim as Func),
    ("trimAll", string::trim_all as Func),
    ("trimPrefix", string::trim_prefix as Func),
    ("trimSuffix", string::trim_suffix as Func),
    ("lower", string::lower as Func),
    ("upper", string::upper as Func),
    ("title", string::title as Func),
    ("untitle", string::untitle as Func),
    ("repeat", string::repeat as Func),
    ("substr", string::substr as Func),
    ("nospace", string::nospace as Func),
    ("trunc", string::trunc as Func),
    ("abbrev", string::abbrev as Func),
    ("abbrevboth", string::abbrevboth as Func),
    ("initials", string::initials as Func),
    ("randAlpha", string::rand_alpha as Func),
    ("randNumeric", string::rand_numeric as Func),
    ("randAlphaNum", string::rand_alpha_num as Func),
    ("randAscii", string::rand_ascii as Func),
    ("contains", string::contains as Func),
    ("hasPrefix", string::has_prefix as Func),
    ("hasSuffix", string::has_suffix as Func),
    ("quote", string::quote as Func),
    ("squote", string::squote as Func),
    ("cat", string::cat as Func),
    ("indent", string::indent as Func),
    ("replace", string::replace as Func),
    ("plural", string::plural as Func),
    ("snakecase", string::snakecase as Func),
    ("camelcase", string::camelcase as Func),
    ("kebabcase", string::kebabcase as Func),
    ("swapcase", string::swapcase as Func),
    ("shuffle", string::shuffle as Func),
    // JSON/YAML conversion functions
    ("toJson", utils::to_json as Func),
    ("toPrettyJson", utils::to_pretty_json as Func),
    ("fromYaml", utils::from_yaml as Func),
    ("fromJson", utils::from_json as Func),
    ("toYaml", utils::to_yaml as Func),
    // Cryptographic/hash functions
    ("sha1sum", crypto::sha1sum as Func),
    ("sha256sum", crypto::sha256sum as Func),
    ("sha512sum", crypto::sha512sum as Func),
    ("md5sum", crypto::md5sum as Func),
    ("htpasswd", crypto::htpasswd as Func),
    // Certificate generation functions
    ("genCA", certs::gen_ca as Func),
    ("genSelfSignedCert", certs::gen_self_signed_cert as Func),
    ("genSignedCert", certs::gen_signed_cert as Func),
    // Utility functions
    ("dict", utils::dict as Func),
    ("list", utils::list as Func),
    // Encoding functions
    ("b64enc", encoding::b64enc as Func),
    ("b64dec", encoding::b64dec as Func),
    ("b32enc", encoding::b32enc as Func),
    ("b32dec", encoding::b32dec as Func),
    // Math functions
    ("add", math::math_add as Func),
    ("sub", math::math_subtract as Func),
    ("div", math::math_divide as Func),
    ("mod", math::math_modulo as Func),
    ("mul", math::math_multiply as Func),
    ("pow", math::math_power as Func),
    // Custom mows functions
    ("mowsRandomString", crypto::random_string as Func),
    ("mowsDigest", crypto::mows_digest as Func),
    ("mowsJoindomain", utils::join_domain as Func),
    // Extended math functions
    ("add1", math::add1 as Func),
    ("max", math::max as Func),
    ("min", math::min as Func),
    ("addf", math::addf as Func),
    ("add1f", math::add1f as Func),
    ("subf", math::subf as Func),
    ("divf", math::divf as Func),
    ("mulf", math::mulf as Func),
    ("maxf", math::maxf as Func),
    ("minf", math::minf as Func),
    ("floor", math::floor as Func),
    ("ceil", math::ceil as Func),
    ("round", math::round as Func),
    // Type conversion and checking functions
    ("atoi", types::atoi as Func),
    ("float64", types::float64 as Func),
    ("int", types::int as Func),
    ("int64", types::int64 as Func),
    ("toString", types::to_string as Func),
    ("toStrings", types::to_strings as Func),
    ("typeOf", types::type_of as Func),
    ("kindOf", types::kind_of as Func),
    ("typeIs", types::type_is as Func),
    ("kindIs", types::kind_is as Func),
    ("deepEqual", types::deep_equal as Func),
    // List/Array functions
    ("first", lists::first as Func),
    ("mustFirst", lists::must_first as Func),
    ("rest", lists::rest as Func),
    ("mustRest", lists::must_rest as Func),
    ("last", lists::last as Func),
    ("mustLast", lists::must_last as Func),
    ("initial", lists::initial as Func),
    ("mustInitial", lists::must_initial as Func),
    ("append", lists::append as Func),
    ("mustAppend", lists::must_append as Func),
    ("prepend", lists::prepend as Func),
    ("mustPrepend", lists::must_prepend as Func),
    ("concat", lists::concat as Func),
    ("reverse", lists::reverse as Func),
    ("mustReverse", lists::must_reverse as Func),
    ("uniq", lists::uniq as Func),
    ("mustUniq", lists::must_uniq as Func),
    ("without", lists::without as Func),
    ("mustWithout", lists::must_without as Func),
    ("has", lists::has as Func),
    ("mustHas", lists::must_has as Func),
    ("compact", lists::compact as Func),
    ("mustCompact", lists::must_compact as Func),
    ("index", lists::index_list as Func),
    ("slice", lists::slice as Func),
    ("mustSlice", lists::must_slice as Func),
    ("until", lists::until as Func),
    ("untilStep", lists::until_step as Func),
    ("seq", lists::seq as Func),
    ("len", lists::len_fn as Func),
    // Dictionary/Map functions
    ("get", dicts::get as Func),
    ("set", dicts::set as Func),
    ("unset", dicts::unset as Func),
    ("hasKey", dicts::has_key as Func),
    ("keys", dicts::keys as Func),
    ("values", dicts::values as Func),
    ("pick", dicts::pick as Func),
    ("omit", dicts::omit as Func),
    ("merge", dicts::merge as Func),
    ("mustMerge", dicts::must_merge as Func),
    ("mergeOverwrite", dicts::merge_overwrite as Func),
    ("mustMergeOverwrite", dicts::must_merge_overwrite as Func),
    ("deepCopy", dicts::deep_copy as Func),
    ("mustDeepCopy", dicts::must_deep_copy as Func),
    ("pluck", dicts::pluck as Func),
    ("dig", dicts::dig as Func),
    // Path functions
    ("base", paths::base as Func),
    ("dir", paths::dir as Func),
    ("clean", paths::clean as Func),
    ("ext", paths::ext as Func),
    ("isAbs", paths::is_abs as Func),
    // Regex functions
    ("regexMatch", regex::regex_match as Func),
    ("mustRegexMatch", regex::must_regex_match as Func),
    ("regexFindAll", regex::regex_find_all as Func),
    ("mustRegexFindAll", regex::must_regex_find_all as Func),
    ("regexFind", regex::regex_find as Func),
    ("mustRegexFind", regex::must_regex_find as Func),
    ("regexReplaceAll", regex::regex_replace_all as Func),
    ("mustRegexReplaceAll", regex::must_regex_replace_all as Func),
    ("regexReplaceAllLiteral", regex::regex_replace_all_literal as Func),
    ("mustRegexReplaceAllLiteral", regex::must_regex_replace_all_literal as Func),
    ("regexSplit", regex::regex_split as Func),
    ("mustRegexSplit", regex::must_regex_split as Func),
    // Miscellaneous functions
    ("uuidv4", misc::uuidv4 as Func),
    ("required", misc::required as Func),
];
