use pektin_common::{
    proto::rr::Name, ARecord, AaaaRecord, CaaRecord, CnameRecord, DbEntry, MxRecord, NsRecord,
    OpenpgpkeyRecord, RrSet, SoaRecord, SrvRecord, TlsaRecord, TxtRecord,
};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use serde_variant::to_variant_name;

/*
This is needed because kubernetes does not accept the default pektin schema
*/

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize, JsonSchema)]
pub struct KubePektinDbEntry {
    #[schemars(with = "String")]
    pub name: Name,
    pub ttl: u32,
    #[serde(default = "default_meta")]
    pub meta: String,
    pub rr_set: KubePektinRrSet,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize, JsonSchema)]
pub enum KubePektinRrSet {
    A(Vec<ARecord>),
    AAAA(Vec<AaaaRecord>),
    CAA(Vec<CaaRecord>),
    CNAME(Vec<CnameRecord>),
    MX(Vec<MxRecord>),
    NS(Vec<NsRecord>),
    OPENPGPKEY(Vec<OpenpgpkeyRecord>),
    SOA(Vec<SoaRecord>),
    SRV(Vec<SrvRecord>),
    TLSA(Vec<TlsaRecord>),
    TXT(Vec<TxtRecord>),
}

impl KubePektinDbEntry {
    pub fn convert_to_pektin_entry(&self) -> Value {
        let rr_set = match &self.rr_set {
            KubePektinRrSet::A(inner) => serde_json::to_value(inner),
            KubePektinRrSet::AAAA(inner) => serde_json::to_value(inner),
            KubePektinRrSet::CAA(inner) => serde_json::to_value(inner),
            KubePektinRrSet::CNAME(inner) => serde_json::to_value(inner),
            KubePektinRrSet::MX(inner) => serde_json::to_value(inner),
            KubePektinRrSet::NS(inner) => serde_json::to_value(inner),
            KubePektinRrSet::OPENPGPKEY(inner) => serde_json::to_value(inner),
            KubePektinRrSet::SOA(inner) => serde_json::to_value(inner),
            KubePektinRrSet::SRV(inner) => serde_json::to_value(inner),
            KubePektinRrSet::TLSA(inner) => serde_json::to_value(inner),
            KubePektinRrSet::TXT(inner) => serde_json::to_value(inner),
        }
        .unwrap();
        json!({
                "meta": self.meta.clone(),
                "name": self.name.clone(),
                "ttl": self.ttl,
                "rr_type": to_variant_name(&self.rr_set).unwrap(),
                "rr_set": rr_set
            }
        )
    }
}

fn default_meta() -> String {
    "".to_string()
}
