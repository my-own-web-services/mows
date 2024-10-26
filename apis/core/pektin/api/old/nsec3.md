The owner name for the NSEC3 RR is the base32 encoding of the hashed
owner name prepended as a single label to the name of the zone.

The NSEC3 RR SHOULD have the same TTL value as the SOA minimum TTL
field. This is in the spirit of negative caching

The Type Bit Maps field of every NSEC3 RR in a signed zone MUST
indicate the presence of all types present at the original owner
name, except for the types solely contributed by an NSEC3 RR
itself. Note that this means that the NSEC3 type itself will
never be present in the Type Bit Maps.

## Next Hashed Owner Name

Note that, unlike the owner name of the NSEC3 RR, the value of this field
does not contain the appended zone name.
The next hashed owner name is not base32 encoded, unlike the owner
name of the NSEC3 RR. It is the unmodified binary hash value.

## Hashing

define:

      IH(salt, x, 0) = H(x || salt), and

      IH(salt, x, k) = H(IH(salt, x, k-1) || salt), if k > 0

Then the calculated hash of an owner name is

      IH(salt, owner name, iterations),
