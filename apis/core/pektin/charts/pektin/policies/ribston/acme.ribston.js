var DnsRecordTypeNum;
(function (DnsRecordTypeNum) {
    DnsRecordTypeNum[DnsRecordTypeNum["A"] = 1] = "A";
    DnsRecordTypeNum[DnsRecordTypeNum["AAAA"] = 28] = "AAAA";
    DnsRecordTypeNum[DnsRecordTypeNum["AFSDB"] = 18] = "AFSDB";
    DnsRecordTypeNum[DnsRecordTypeNum["APL"] = 42] = "APL";
    DnsRecordTypeNum[DnsRecordTypeNum["CAA"] = 257] = "CAA";
    DnsRecordTypeNum[DnsRecordTypeNum["CDNSKEY"] = 60] = "CDNSKEY";
    DnsRecordTypeNum[DnsRecordTypeNum["CDS"] = 59] = "CDS";
    DnsRecordTypeNum[DnsRecordTypeNum["CERT"] = 37] = "CERT";
    DnsRecordTypeNum[DnsRecordTypeNum["CNAME"] = 5] = "CNAME";
    DnsRecordTypeNum[DnsRecordTypeNum["CSYNC"] = 62] = "CSYNC";
    DnsRecordTypeNum[DnsRecordTypeNum["DHCID"] = 49] = "DHCID";
    DnsRecordTypeNum[DnsRecordTypeNum["DLV"] = 32769] = "DLV";
    DnsRecordTypeNum[DnsRecordTypeNum["DNAME"] = 39] = "DNAME";
    DnsRecordTypeNum[DnsRecordTypeNum["DNSKEY"] = 48] = "DNSKEY";
    DnsRecordTypeNum[DnsRecordTypeNum["DS"] = 43] = "DS";
    DnsRecordTypeNum[DnsRecordTypeNum["EUI48"] = 108] = "EUI48";
    DnsRecordTypeNum[DnsRecordTypeNum["EUI64"] = 109] = "EUI64";
    DnsRecordTypeNum[DnsRecordTypeNum["HINFO"] = 13] = "HINFO";
    DnsRecordTypeNum[DnsRecordTypeNum["HIP"] = 55] = "HIP";
    DnsRecordTypeNum[DnsRecordTypeNum["HTTPS"] = 65] = "HTTPS";
    DnsRecordTypeNum[DnsRecordTypeNum["IPSECKEY"] = 45] = "IPSECKEY";
    DnsRecordTypeNum[DnsRecordTypeNum["KEY"] = 25] = "KEY";
    DnsRecordTypeNum[DnsRecordTypeNum["KX"] = 36] = "KX";
    DnsRecordTypeNum[DnsRecordTypeNum["LOC"] = 29] = "LOC";
    DnsRecordTypeNum[DnsRecordTypeNum["MX"] = 15] = "MX";
    DnsRecordTypeNum[DnsRecordTypeNum["NAPTR"] = 35] = "NAPTR";
    DnsRecordTypeNum[DnsRecordTypeNum["NS"] = 2] = "NS";
    DnsRecordTypeNum[DnsRecordTypeNum["NSEC"] = 47] = "NSEC";
    DnsRecordTypeNum[DnsRecordTypeNum["NSEC3"] = 50] = "NSEC3";
    DnsRecordTypeNum[DnsRecordTypeNum["NSEC3PARAM"] = 51] = "NSEC3PARAM";
    DnsRecordTypeNum[DnsRecordTypeNum["OPENPGPKEY"] = 61] = "OPENPGPKEY";
    DnsRecordTypeNum[DnsRecordTypeNum["PTR"] = 12] = "PTR";
    DnsRecordTypeNum[DnsRecordTypeNum["RRSIG"] = 46] = "RRSIG";
    DnsRecordTypeNum[DnsRecordTypeNum["RP"] = 17] = "RP";
    DnsRecordTypeNum[DnsRecordTypeNum["SIG"] = 24] = "SIG";
    DnsRecordTypeNum[DnsRecordTypeNum["SMIMEA"] = 53] = "SMIMEA";
    DnsRecordTypeNum[DnsRecordTypeNum["SOA"] = 6] = "SOA";
    DnsRecordTypeNum[DnsRecordTypeNum["SRV"] = 33] = "SRV";
    DnsRecordTypeNum[DnsRecordTypeNum["SSHFP"] = 44] = "SSHFP";
    DnsRecordTypeNum[DnsRecordTypeNum["SVCB"] = 64] = "SVCB";
    DnsRecordTypeNum[DnsRecordTypeNum["TA"] = 32768] = "TA";
    DnsRecordTypeNum[DnsRecordTypeNum["TKEY"] = 249] = "TKEY";
    DnsRecordTypeNum[DnsRecordTypeNum["TLSA"] = 52] = "TLSA";
    DnsRecordTypeNum[DnsRecordTypeNum["TSIG"] = 250] = "TSIG";
    DnsRecordTypeNum[DnsRecordTypeNum["TXT"] = 16] = "TXT";
    DnsRecordTypeNum[DnsRecordTypeNum["URI"] = 256] = "URI";
    DnsRecordTypeNum[DnsRecordTypeNum["ZONEMD"] = 63] = "ZONEMD";
})(DnsRecordTypeNum || (DnsRecordTypeNum = {}));
var DnsRecordType;
(function (DnsRecordType) {
    DnsRecordType["A"] = "A";
    DnsRecordType["AAAA"] = "AAAA";
    DnsRecordType["AFSDB"] = "AFSDB";
    DnsRecordType["APL"] = "APL";
    DnsRecordType["CAA"] = "CAA";
    DnsRecordType["CDNSKEY"] = "CDNSKEY";
    DnsRecordType["CDS"] = "CDS";
    DnsRecordType["CERT"] = "CERT";
    DnsRecordType["CNAME"] = "CNAME";
    DnsRecordType["CSYNC"] = "CSYNC";
    DnsRecordType["DHCID"] = "DHCID";
    DnsRecordType["DLV"] = "DLV";
    DnsRecordType["DNAME"] = "DNAME";
    DnsRecordType["DNSKEY"] = "DNSKEY";
    DnsRecordType["DS"] = "DS";
    DnsRecordType["EUI48"] = "EUI48";
    DnsRecordType["EUI64"] = "EUI64";
    DnsRecordType["HINFO"] = "HINFO";
    DnsRecordType["HIP"] = "HIP";
    DnsRecordType["HTTPS"] = "HTTPS";
    DnsRecordType["IPSECKEY"] = "IPSECKEY";
    DnsRecordType["KEY"] = "KEY";
    DnsRecordType["KX"] = "KX";
    DnsRecordType["LOC"] = "LOC";
    DnsRecordType["MX"] = "MX";
    DnsRecordType["NAPTR"] = "NAPTR";
    DnsRecordType["NS"] = "NS";
    DnsRecordType["NSEC"] = "NSEC";
    DnsRecordType["NSEC3"] = "NSEC3";
    DnsRecordType["NSEC3PARAM"] = "NSEC3PARAM";
    DnsRecordType["OPENPGPKEY"] = "OPENPGPKEY";
    DnsRecordType["PTR"] = "PTR";
    DnsRecordType["RRSIG"] = "RRSIG";
    DnsRecordType["RP"] = "RP";
    DnsRecordType["SIG"] = "SIG";
    DnsRecordType["SMIMEA"] = "SMIMEA";
    DnsRecordType["SOA"] = "SOA";
    DnsRecordType["SRV"] = "SRV";
    DnsRecordType["SSHFP"] = "SSHFP";
    DnsRecordType["SVCB"] = "SVCB";
    DnsRecordType["TA"] = "TA";
    DnsRecordType["TKEY"] = "TKEY";
    DnsRecordType["TLSA"] = "TLSA";
    DnsRecordType["TSIG"] = "TSIG";
    DnsRecordType["TXT"] = "TXT";
    DnsRecordType["URI"] = "URI";
    DnsRecordType["ZONEMD"] = "ZONEMD";
})(DnsRecordType || (DnsRecordType = {}));
var DnssecAlgorithmType;
(function (DnssecAlgorithmType) {
    DnssecAlgorithmType[DnssecAlgorithmType["DELETE"] = 0] = "DELETE";
    DnssecAlgorithmType[DnssecAlgorithmType["RSAMD5"] = 1] = "RSAMD5";
    DnssecAlgorithmType[DnssecAlgorithmType["DH"] = 2] = "DH";
    DnssecAlgorithmType[DnssecAlgorithmType["DSA"] = 3] = "DSA";
    DnssecAlgorithmType[DnssecAlgorithmType["RSASHA1"] = 5] = "RSASHA1";
    DnssecAlgorithmType[DnssecAlgorithmType["DSA-NSEC3-SHA1"] = 6] = "DSA-NSEC3-SHA1";
    DnssecAlgorithmType[DnssecAlgorithmType["RSASHA1-NSEC3-SHA1"] = 7] = "RSASHA1-NSEC3-SHA1";
    DnssecAlgorithmType[DnssecAlgorithmType["RSASHA256"] = 8] = "RSASHA256";
    DnssecAlgorithmType[DnssecAlgorithmType["RSASHA512"] = 10] = "RSASHA512";
    DnssecAlgorithmType[DnssecAlgorithmType["ECC-GOST"] = 12] = "ECC-GOST";
    DnssecAlgorithmType[DnssecAlgorithmType["ECDSAP256SHA256"] = 13] = "ECDSAP256SHA256";
    DnssecAlgorithmType[DnssecAlgorithmType["ECDSAP384SHA384"] = 14] = "ECDSAP384SHA384";
    DnssecAlgorithmType[DnssecAlgorithmType["ED25519"] = 15] = "ED25519";
    DnssecAlgorithmType[DnssecAlgorithmType["ED448"] = 16] = "ED448";
})(DnssecAlgorithmType || (DnssecAlgorithmType = {}));
/* eslint-disable no-unused-vars */
var ApiResponseType;
(function (ApiResponseType) {
    ApiResponseType["Success"] = "success";
    ApiResponseType["PartialSuccess"] = "partial-success";
    ApiResponseType["Error"] = "error";
    ApiResponseType["Ignored"] = "ignored";
})(ApiResponseType || (ApiResponseType = {}));
/* eslint-disable no-unused-vars */
var PektinRRType;
(function (PektinRRType) {
    PektinRRType["A"] = "A";
    PektinRRType["AAAA"] = "AAAA";
    PektinRRType["CAA"] = "CAA";
    PektinRRType["CNAME"] = "CNAME";
    PektinRRType["MX"] = "MX";
    PektinRRType["NS"] = "NS";
    PektinRRType["OPENPGPKEY"] = "OPENPGPKEY";
    PektinRRType["SOA"] = "SOA";
    PektinRRType["SRV"] = "SRV";
    PektinRRType["TLSA"] = "TLSA";
    PektinRRType["TXT"] = "TXT";
})(PektinRRType || (PektinRRType = {}));
var FetchType;
(function (FetchType) {
    FetchType[FetchType["direct"] = 0] = "direct";
    FetchType[FetchType["proxy"] = 1] = "proxy";
})(FetchType || (FetchType = {}));

const deny = (o, msg) => {
    o.status = `ERROR`;
    o.message = msg;
};
const allow = (o, msg = `Success`) => {
    o.status = `SUCCESS`;
    o.message = msg;
};
const getBodyForApiMethod = (input) => {
    switch (input.api_method) {
        case `get`:
            return input.request_body.Get;
        case `get-zone-records`:
            return input.request_body.GetZoneRecords;
        case `set`:
            return input.request_body.Set;
        case `search`:
            return input.request_body.Search;
        case `delete`:
            return input.request_body.Delete;
    }
};

/*
POLICY INFORMATION
{
    "version": "1.0.0",
    "use":"pektin-dns",
    "name": "acme",
    "class": "acme",
    "contact": "pektin@vindelicum.eu"
}
*/
const input = {};
const output = {
    status: `UNDECIDED`,
    message: `Policy didn't reach a decission`,
};
/* Your code goes beneath this */
if (input.api_method === `get`) {
    const allRecordsValid = input.request_body.Get.records.every((record) => {
        return record.name.startsWith(`_acme-challenge`) && record.rr_type === PektinRRType.TXT;
    });
    if (allRecordsValid) {
        allow(output);
    }
    else {
        deny(output, `Name not allowed`);
    }
}
else if (input.api_method === `delete` || input.api_method === `set`) {
    const body = getBodyForApiMethod(input);
    /*@ts-ignore*/
    const allRecordsValid = body.records.every((record) => {
        return record.name.startsWith(`_acme-challenge`) && record.rr_type === PektinRRType.TXT;
    });
    if (allRecordsValid) {
        allow(output);
    }
    else {
        deny(output, `Name not allowed`);
    }
}
else if (input.api_method === `search`) {
    const allRecordsValid = input.request_body.Search.globs.every((record) => {
        return record.rr_type_glob === PektinRRType.SOA;
    });
    if (allRecordsValid) {
        allow(output);
    }
    else {
        deny(output, `rr_type_glob not allowed`);
    }
}
else {
    deny(output, `API method '${input.api_method}' not allowed`);
}
