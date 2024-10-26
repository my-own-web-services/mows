pub use deadpool_redis;
use proto::rr::dnssec;
use proto::rr::dnssec::rdata::{DNSSECRData, DNSKEY, NSEC3, NSEC3PARAM, SIG};
use proto::rr::rdata::{caa, tlsa, MX, OPENPGPKEY, SOA, SRV, TXT};
use proto::rr::{Name, RData, RecordType};
pub use trust_dns_proto as proto;

use deadpool_redis::redis::AsyncCommands;
use deadpool_redis::Connection;
use serde::{Deserialize, Serialize};
use serde_repr::{Deserialize_repr, Serialize_repr};
use std::{
    convert::{TryFrom, TryInto},
    env, fs,
    net::{Ipv4Addr, Ipv6Addr},
};
use thiserror::Error;
use tracing::{debug, error, instrument, trace};

#[derive(Debug, Error)]
pub enum PektinCommonError {
    #[error("Environment variable {0} is required, but not set")]
    MissingEnvVar(String),
    #[error("Environment variable {0} is invalid")]
    InvalidEnvVar(String),
    #[error("Couldn't read file based environment variable: {0} from path: {1} \n {2}")]
    InvalidEnvVarFilePath(String, String, String),
    #[error("Error contacting Db")]
    Db(#[from] deadpool_redis::redis::RedisError),
    #[error("Could not (de)serialize JSON")]
    Json(#[from] serde_json::Error),
}

// The following type definitions may seem weird (because they are), but they were crafted
// carefully to make the serialized JSON look nice.

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct ARecord {
    pub value: Ipv4Addr,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct AaaaRecord {
    pub value: Ipv6Addr,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct CaaRecord {
    pub issuer_critical: bool,
    pub tag: Property,
    pub value: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct CnameRecord {
    pub value: Name,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct DnskeyRecord {
    pub zone: bool,
    pub revoked: bool,
    pub secure_entry_point: bool,
    pub algorithm: DnssecAlgorithm,
    pub key: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct MxRecord {
    #[serde(flatten)]
    pub value: MX,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct NsRecord {
    pub value: Name,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct Nsec3Record {
    pub hash_algorithm: HashAlgorithm,
    pub opt_out: bool,
    pub iterations: u16,
    pub salt: Option<Vec<u8>>,
    pub next_hashed_owner: Vec<u8>,
    pub types: Vec<RecordType>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct Nsec3ParamRecord {
    pub hash_algorithm: HashAlgorithm,
    pub iterations: u16,
    pub salt: Option<Vec<u8>>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct OpenpgpkeyRecord {
    pub value: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct RrsigRecord {
    pub type_covered: RecordType,
    pub algorithm: DnssecAlgorithm,
    pub labels: u8,
    pub original_ttl: u32,
    pub signature_expiration: u32,
    pub signature_inception: u32,
    pub key_tag: u16,
    pub signer_name: Name,
    pub signature: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct SoaRecord {
    #[serde(flatten)]
    pub value: SOA,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct SrvRecord {
    #[serde(flatten)]
    pub value: SRV,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct TlsaRecord {
    pub cert_usage: CertUsage,
    pub selector: Selector,
    pub matching: Matching,
    pub cert_data: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct TxtRecord {
    pub value: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(tag = "rr_type")]
pub enum RrSet {
    A { rr_set: Vec<ARecord> },
    AAAA { rr_set: Vec<AaaaRecord> },
    CAA { rr_set: Vec<CaaRecord> },
    CNAME { rr_set: Vec<CnameRecord> },
    DNSKEY { rr_set: Vec<DnskeyRecord> },
    MX { rr_set: Vec<MxRecord> },
    NS { rr_set: Vec<NsRecord> },
    NSEC3 { rr_set: Vec<Nsec3Record> },
    NSEC3PARAM { rr_set: Vec<Nsec3ParamRecord> },
    OPENPGPKEY { rr_set: Vec<OpenpgpkeyRecord> },
    RRSIG { rr_set: Vec<RrsigRecord> },
    SOA { rr_set: Vec<SoaRecord> },
    SRV { rr_set: Vec<SrvRecord> },
    TLSA { rr_set: Vec<TlsaRecord> },
    TXT { rr_set: Vec<TxtRecord> },
}

macro_rules! rr_set_vec {
    ($self:ident, $vec_name:ident, $vec_expr:expr) => {
        match $self {
            RrSet::A { $vec_name } => $vec_expr,
            RrSet::AAAA { $vec_name } => $vec_expr,
            RrSet::CAA { $vec_name } => $vec_expr,
            RrSet::CNAME { $vec_name } => $vec_expr,
            RrSet::DNSKEY { $vec_name } => $vec_expr,
            RrSet::MX { $vec_name } => $vec_expr,
            RrSet::NS { $vec_name } => $vec_expr,
            RrSet::NSEC3 { $vec_name } => $vec_expr,
            RrSet::NSEC3PARAM { $vec_name } => $vec_expr,
            RrSet::OPENPGPKEY { $vec_name } => $vec_expr,
            RrSet::RRSIG { $vec_name } => $vec_expr,
            RrSet::SOA { $vec_name } => $vec_expr,
            RrSet::SRV { $vec_name } => $vec_expr,
            RrSet::TLSA { $vec_name } => $vec_expr,
            RrSet::TXT { $vec_name } => $vec_expr,
        }
    };
}

impl RrSet {
    pub fn len(&self) -> usize {
        rr_set_vec!(self, rr_set, rr_set.len())
    }

    pub fn is_empty(&self) -> bool {
        rr_set_vec!(self, rr_set, rr_set.is_empty())
    }

    pub fn rr_type(&self) -> RecordType {
        match self {
            RrSet::A { .. } => RecordType::A,
            RrSet::AAAA { .. } => RecordType::AAAA,
            RrSet::CAA { .. } => RecordType::CAA,
            RrSet::CNAME { .. } => RecordType::CNAME,
            RrSet::DNSKEY { .. } => RecordType::DNSKEY,
            RrSet::MX { .. } => RecordType::MX,
            RrSet::NS { .. } => RecordType::NS,
            RrSet::NSEC3 { .. } => RecordType::NSEC3,
            RrSet::NSEC3PARAM { .. } => RecordType::NSEC3PARAM,
            RrSet::OPENPGPKEY { .. } => RecordType::OPENPGPKEY,
            RrSet::RRSIG { .. } => RecordType::RRSIG,
            RrSet::SOA { .. } => RecordType::SOA,
            RrSet::SRV { .. } => RecordType::SRV,
            RrSet::TLSA { .. } => RecordType::TLSA,
            RrSet::TXT { .. } => RecordType::TXT,
        }
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct DbEntry {
    pub name: Name,
    pub ttl: u32,
    #[serde(default = "default_meta")]
    pub meta: String,
    #[serde(flatten)]
    pub rr_set: RrSet,
}

fn default_meta() -> String {
    "".to_string()
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Serialize)]
pub enum Property {
    #[serde(rename = "iodef")]
    Iodef,
    #[serde(rename = "issue")]
    Issue,
    #[serde(rename = "issuewild")]
    IssueWild,
}

impl From<Property> for caa::Property {
    fn from(prop: Property) -> Self {
        match prop {
            Property::Iodef => caa::Property::Iodef,
            Property::Issue => caa::Property::Issue,
            Property::IssueWild => caa::Property::IssueWild,
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize_repr, PartialEq, Serialize_repr)]
#[repr(u8)]
pub enum CertUsage {
    CA = 0,
    Service = 1,
    TrustAnchor = 2,
    DomainIssued = 3,
}

impl From<CertUsage> for tlsa::CertUsage {
    fn from(usage: CertUsage) -> Self {
        match usage {
            CertUsage::CA => Self::CA,
            CertUsage::Service => Self::Service,
            CertUsage::TrustAnchor => Self::TrustAnchor,
            CertUsage::DomainIssued => Self::DomainIssued,
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize_repr, PartialEq, Serialize_repr)]
#[repr(u8)]
pub enum Selector {
    Full = 0,
    Spki = 1,
}

impl From<Selector> for tlsa::Selector {
    fn from(selector: Selector) -> Self {
        match selector {
            Selector::Full => Self::Full,
            Selector::Spki => Self::Spki,
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize_repr, PartialEq, Serialize_repr)]
#[repr(u8)]
pub enum Matching {
    Raw = 0,
    Sha256 = 1,
    Sha512 = 2,
}

impl From<Matching> for tlsa::Matching {
    fn from(matching: Matching) -> Self {
        match matching {
            Matching::Raw => Self::Raw,
            Matching::Sha256 => Self::Sha256,
            Matching::Sha512 => Self::Sha512,
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize_repr, PartialEq, Serialize_repr)]
#[repr(u8)]
pub enum HashAlgorithm {
    SHA1 = 1,
}

impl From<HashAlgorithm> for dnssec::Nsec3HashAlgorithm {
    fn from(algorithm: HashAlgorithm) -> Self {
        match algorithm {
            HashAlgorithm::SHA1 => Self::SHA1,
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize_repr, PartialEq, Serialize_repr)]
#[repr(u8)]
pub enum DnssecAlgorithm {
    ECDSAP256SHA256 = 13,
}

impl From<DnssecAlgorithm> for dnssec::Algorithm {
    fn from(algorithm: DnssecAlgorithm) -> Self {
        match algorithm {
            DnssecAlgorithm::ECDSAP256SHA256 => Self::ECDSAP256SHA256,
        }
    }
}

impl DbEntry {
    /// Tries to convert the entry to a vector of TrustDNS's [`Record`](trust_dns_proto::rr::Record)
    /// type.
    pub fn convert(self) -> Result<Vec<trust_dns_proto::rr::Record>, String> {
        self.try_into()
    }

    /// The key to use in db for this entry.
    pub fn db_key(&self) -> String {
        let key = match &self.rr_set {
            RrSet::RRSIG { rr_set, .. } => {
                let type_covered = rr_set
                    .get(0)
                    .expect("no RRSIG record in RRSIG RRset")
                    .type_covered;
                format!("{}:RRSIG:{}", self.name.to_lowercase(), type_covered)
            }
            _ => format!("{}:{}", self.name.to_lowercase(), self.rr_type()),
        };
        trace!("db key for entry {:?} is {}", self, key);
        key
    }

    /// Serializes this entry to store it in db.
    ///
    /// Note that deserializing must be done using
    /// [`deserialize_from_db()`](DbEntry::deserialize_from_db()).
    pub fn serialize_for_db(&self) -> Result<String, PektinCommonError> {
        let json = serde_json::to_string(self)?;
        trace!("serialized db entry to json: {}", json);
        Ok(json)
    }

    /// Deserializes a [`DbEntry`] from a db key and value.
    ///
    /// The value must match the format that is returned by
    /// [`serialize_for_db()`](DbEntry::serialize_for_db()).
    pub fn deserialize_from_db(
        db_key: impl AsRef<str>,
        db_value: impl AsRef<str>,
    ) -> Result<Self, PektinCommonError> {
        let (db_key, db_value) = (db_key.as_ref(), db_value.as_ref());
        trace!(
            "Deserializing db entry from key {} and value {}",
            db_key,
            db_value
        );
        serde_json::from_str(db_value).map_err(Into::into)
    }

    pub fn rr_type(&self) -> RecordType {
        self.rr_set.rr_type()
    }
}

impl TryFrom<DbEntry> for Vec<trust_dns_proto::rr::Record> {
    type Error = String;
    fn try_from(entry: DbEntry) -> Result<Self, String> {
        use trust_dns_proto::rr::Record;
        match entry.rr_set {
            RrSet::A { rr_set } => Ok(rr_set
                .into_iter()
                .map(|data| Record::from_rdata(entry.name.clone(), entry.ttl, RData::A(data.value)))
                .collect()),
            RrSet::AAAA { rr_set } => Ok(rr_set
                .into_iter()
                .map(|data| {
                    Record::from_rdata(entry.name.clone(), entry.ttl, RData::AAAA(data.value))
                })
                .collect()),
            RrSet::CAA { rr_set } => {
                // and now for the tricky bit (RIP Joe Armstrong)
                let conv = |record: CaaRecord| {
                    let value = match record.tag {
                        Property::Iodef => caa::Value::Url(
                            url::Url::parse(&record.value)
                                .map_err(|_| "invalid CAA iodef url".to_string())?,
                        ),
                        Property::Issue => caa::Value::Issuer(
                            Some(
                                Name::from_utf8(record.value)
                                    .map_err(|_| "invalid CAA issue name".to_string())?,
                            ),
                            vec![],
                        ),
                        Property::IssueWild => caa::Value::Issuer(
                            Some(
                                Name::from_utf8(record.value)
                                    .map_err(|_| "invalid CAA issuewild name".to_string())?,
                            ),
                            vec![],
                        ),
                    };
                    Ok(Record::from_rdata(
                        entry.name.clone(),
                        entry.ttl,
                        RData::CAA(caa::CAA {
                            issuer_critical: record.issuer_critical,
                            tag: record.tag.into(),
                            value,
                        }),
                    ))
                };
                rr_set.into_iter().map(conv).collect()
            }
            RrSet::CNAME { rr_set } => Ok(rr_set
                .into_iter()
                .map(|data| {
                    Record::from_rdata(entry.name.clone(), entry.ttl, RData::CNAME(data.value))
                })
                .collect()),
            RrSet::DNSKEY { rr_set } => {
                let conv = |record: DnskeyRecord| {
                    Ok(Record::from_rdata(
                        entry.name.clone(),
                        entry.ttl,
                        RData::DNSSEC(DNSSECRData::DNSKEY(DNSKEY::new(
                            record.zone,
                            record.secure_entry_point,
                            record.revoked,
                            record.algorithm.into(),
                            base64::decode(&record.key)
                                .map_err(|_| "DNSKEY key not valid base64 (a-zA-Z0-9/+)")?,
                        ))),
                    ))
                };
                rr_set.into_iter().map(conv).collect()
            }
            RrSet::MX { rr_set } => Ok(rr_set
                .into_iter()
                .map(|data| {
                    Record::from_rdata(entry.name.clone(), entry.ttl, RData::MX(data.value))
                })
                .collect()),
            RrSet::NS { rr_set } => Ok(rr_set
                .into_iter()
                .map(|data| {
                    Record::from_rdata(entry.name.clone(), entry.ttl, RData::NS(data.value))
                })
                .collect()),
            RrSet::NSEC3 { rr_set } => {
                let conv = |record: Nsec3Record| {
                    let mut record = Record::from_rdata(
                        entry.name.clone(),
                        entry.ttl,
                        RData::DNSSEC(DNSSECRData::NSEC3(NSEC3::new(
                            record.hash_algorithm.into(),
                            record.opt_out,
                            record.iterations,
                            record.salt.unwrap_or_default(),
                            record.next_hashed_owner,
                            record.types,
                        ))),
                    );
                    record.set_rr_type(RecordType::NSEC3);
                    Ok(record)
                };
                rr_set.into_iter().map(conv).collect()
            }
            RrSet::NSEC3PARAM { rr_set } => {
                let conv = |record: Nsec3ParamRecord| {
                    let mut record = Record::from_rdata(
                        entry.name.clone(),
                        entry.ttl,
                        RData::DNSSEC(DNSSECRData::NSEC3PARAM(NSEC3PARAM::new(
                            record.hash_algorithm.into(),
                            false,
                            record.iterations,
                            record.salt.unwrap_or_default(),
                        ))),
                    );
                    record.set_rr_type(RecordType::NSEC3PARAM);
                    Ok(record)
                };
                rr_set.into_iter().map(conv).collect()
            }
            RrSet::OPENPGPKEY { rr_set } => {
                let conv = |record: OpenpgpkeyRecord| {
                    Ok(Record::from_rdata(
                        entry.name.clone(),
                        entry.ttl,
                        RData::OPENPGPKEY(OPENPGPKEY::new(
                            base64::decode(&record.value)
                                .map_err(|_| "OPENPGPKEY data not valid base64 (a-zA-Z0-9/+)")?,
                        )),
                    ))
                };
                rr_set.into_iter().map(conv).collect()
            }
            RrSet::RRSIG { rr_set } => {
                let conv = |record: RrsigRecord| {
                    let mut record = Record::from_rdata(
                        entry.name.clone(),
                        entry.ttl,
                        RData::DNSSEC(DNSSECRData::SIG(SIG::new(
                            record.type_covered,
                            record.algorithm.into(),
                            record.labels,
                            record.original_ttl,
                            record.signature_expiration,
                            record.signature_inception,
                            record.key_tag,
                            record.signer_name,
                            base64::decode(&record.signature)
                                .map_err(|_| "RRSIG signature not valid base64 (a-zA-Z0-9/+)")?,
                        ))),
                    );
                    record.set_rr_type(RecordType::RRSIG);
                    Ok(record)
                };
                rr_set.into_iter().map(conv).collect()
            }
            RrSet::SOA { rr_set } => Ok(rr_set
                .into_iter()
                .map(|data| {
                    Record::from_rdata(entry.name.clone(), entry.ttl, RData::SOA(data.value))
                })
                .collect()),
            RrSet::SRV { rr_set } => Ok(rr_set
                .into_iter()
                .map(|data| {
                    Record::from_rdata(entry.name.clone(), entry.ttl, RData::SRV(data.value))
                })
                .collect()),
            RrSet::TLSA { rr_set } => {
                let conv = |record: TlsaRecord| {
                    Ok(Record::from_rdata(
                        entry.name.clone(),
                        entry.ttl,
                        RData::TLSA(tlsa::TLSA::new(
                            record.cert_usage.into(),
                            record.selector.into(),
                            record.matching.into(),
                            hex::decode(&record.cert_data).map_err(|_| {
                                "TLSA certificate data not hexadecimal data".to_string()
                            })?,
                        )),
                    ))
                };
                rr_set.into_iter().map(conv).collect()
            }
            RrSet::TXT { rr_set } => Ok(rr_set
                .into_iter()
                .map(|data| {
                    Record::from_rdata(
                        entry.name.clone(),
                        entry.ttl,
                        RData::TXT(TXT::new(vec![data.value])),
                    )
                })
                .collect()),
        }
    }
}

pub fn load_env(
    default: &str,
    param_name: &str,
    confidential: bool,
) -> Result<String, PektinCommonError> {
    let res = if let Ok(param) = env::var(param_name) {
        if param_name.ends_with("_FILE") {
            return match fs::read_to_string(&param) {
                Ok(val) => Ok(val),
                Err(err) => Err(PektinCommonError::InvalidEnvVarFilePath(
                    param_name.into(),
                    param,
                    err.to_string(),
                )),
            };
        }
        param
    } else if default.is_empty() {
        return Err(PektinCommonError::MissingEnvVar(param_name.into()));
    } else {
        default.into()
    };
    if !confidential {
        println!("\t{}={}", param_name, res);
    } else {
        println!("\t{}=<REDACTED (len={})>", param_name, res.len());
    }
    Ok(res)
}

// find all zones that we are authoritative for
#[instrument(skip(con))]
pub async fn get_authoritative_zones(
    con: &mut Connection,
) -> Result<Vec<String>, PektinCommonError> {
    let zones = con
        .keys::<_, Vec<String>>("*.:SOA")
        .await?
        .into_iter()
        .map(|mut key| {
            key.truncate(key.find(':').unwrap());
            key
        })
        .collect();
    debug!("found authoritative zones: {:?}", zones);
    Ok(zones)
}
