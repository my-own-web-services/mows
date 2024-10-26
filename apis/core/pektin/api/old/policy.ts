const input: Input = {} as Input;
const output: Output = {} as Output;
/* Your code goes beneath this */
export interface PektinResourceRecord {
    ttl: number;
    value: PektinResourceRecordValue;
}

// the resource record value
type PektinResourceRecordValue =
    | A
    | AAAA
    | NS
    | CNAME
    | SOA
    | MX
    | TXT
    | SRV
    | CAA
    | OPENPGPKEY
    | TLSA;

interface A {
    [A: string]: string;
}
interface AAAA {
    [AAAA: string]: string;
}
interface NS {
    [NS: string]: string;
}
interface CNAME {
    [CNAME: string]: string;
}

interface SOA {
    [SOA: string]: SOAValue;
}
interface SOAValue {
    mname: string;
    rname: string;
    serial: number;
    refresh: number;
    retry: number;
    expire: number;
    minimum: number;
}
interface MX {
    [MX: string]: MXValue;
}
interface MXValue {
    preference: number;
    exchange: string;
}
interface TXT {
    [TXT: string]: string;
}

interface SRV {
    [SRV: string]: SRVValue;
}
interface SRVValue {
    priority: number;
    weight: number;
    port: number;
    target: string;
}

interface CAA {
    [CAA: string]: CAAValue;
}
interface CAAValue {
    issuer_critical: boolean;
    tag: "Issue" | "IssueWild" | "Iodef";
    value: Issuer[] | Url;
}
interface Issuer {
    key: string;
    value: string;
}
type Url = `https://${string}` | `http://${string}` | `mailto:${string}`;

interface OPENPGPKEY {
    [OPENPGPKEY: string]: string;
}

interface TLSA {
    [TLSA: string]: TLSAValue;
}
interface TLSAValue {
    cert_usage: number;
    selector: number;
    matching: number;
    cert_data: string;
}

export interface RedisEntry {
    name: string;
    rr_set: PektinRRset;
}

export type PektinRRset = Array<PektinResourceRecord>;

export interface RedisEntry {
    name: string;
    rr_set: PektinRRset;
}

interface Input {
    readonly api_method: string;
    readonly ip: string;
    readonly utc_millis: number;
    readonly user_agent: string;
    readonly redis_entries: RedisEntry[];
}

interface Output {
    api_method: boolean;
    ip: boolean;
    utc_millis: boolean;
    user_agent: boolean;
    redis_entries: {
        name: boolean;
        rr_set: boolean;
    }[];
}

output.api_method = ["set", "get", "delete"].includes(input.api_method);
output.ip = true;
output.utc_millis = true;
output.user_agent = true;
output.redis_entries = input.redis_entries.map(rr_set => {
    return {
        name: rr_set.name.startsWith("_acme-challenge") && rr_set.name.endsWith(".:TXT"),
        rr_set: true
    };
});
