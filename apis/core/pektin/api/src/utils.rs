use pektin_common::proto::rr::Name;
use rand::{distributions::Alphanumeric, thread_rng, Rng};

// creates a crypto random string
pub fn random_string() -> String {
    thread_rng()
        .sample_iter(&Alphanumeric)
        .take(100)
        .map(char::from)
        .collect()
}

pub fn deabsolute(name: &str) -> &str {
    if let Some(deabsolute) = name.strip_suffix('.') {
        deabsolute
    } else {
        name
    }
}

/// Takes a `Name` and a list of authoritative zones and returns the most specific zone (i.e. the
/// one with the most labels) that contains the given `Name`.
pub fn find_authoritative_zone(name: &Name, authoritative_zones: &[Name]) -> Option<Name> {
    let mut authoritative_zones = authoritative_zones.to_owned();
    // the - makes it sort the zones with the most labels first
    authoritative_zones.sort_by_key(|zone| -(zone.num_labels() as i16));
    authoritative_zones
        .into_iter()
        .find(|zone| zone.zone_of(name))
}

// panics if `json` is not valid JSON
pub fn prettify_json(json: &str) -> String {
    serde_json::to_string_pretty(
        &serde_json::from_str::<serde_json::Value>(json).expect("Tried to prettify invalid JSON"),
    )
    .unwrap_or_else(|_| json.to_string())
}
