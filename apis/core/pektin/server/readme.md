keyTag ,algorithm, flag, digest, pubKey
36131, 13/ECDSAP256SHA256, 257/KSK, sha256, pubKey
show info in UI

```json
{
    "rr_type": "A",
    "rr_set": [
        {
            "ttl": 3600,
            "value": {
                "A": "1.1.1.1"
            }
        }
    ]
}
```

```json
{
    "rr_type": "A",
    "rr_set": [
        {
            "ttl": 3600,
            "value": {
                "A": "1.1.1.1"
            }
        },
        {
            "ttl": 7200,
            "value": {
                "A": "1.1.2.2"
            }
        }
    ]
}
```

```json
{
    "rr_type": "SOA",
    "rr_set": [
        {
            "ttl": 3600,
            "value": {
                "SOA": {
                    "mname": "deine.mutter.",
                    "rname": "hostmaster.",
                    "serial": 0,
                    "refresh": 0,
                    "retry": 0,
                    "expire": 0,
                    "minimum": 0
                }
            }
        }
    ]
}
```

doh via curl:

```sh
curl -v '[::]:42069/dns-query?dns=base64'
curl -v -H 'Content-Type: application/dns-message' -d 'deadbeef' '[::]:42069/dns-query'
```

dnssec signing workflow:

-   construct a rrsig record with its rdata containing an empty vec as the signature
-   call trust_dns_proto::rr::dnssec::tbs::rrset_tbs_with_rrsig() with the constructed rrsig record and the other records that shall be signed
-   this gives us a TBS struct, which can be converted to a byte slice
-   send these bytes to the vault for signing
-   update the signature in the rrsig record from the first step
-   serialize the rrsig to json and store in db
