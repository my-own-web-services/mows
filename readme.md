webdav server

torrent integration

file system watcher

api

database

ui

apps to work with data

images in multiple formats and resolutions
maybe custom format?

proper access management for files

access management methods:

-   acl lists
-   ribston policy

per user limit:
storage limit
traffic limit

share a file with a user on the server
share a file with a link
share folders with links
enable random users to upload files via a link

```yaml
# user
id: 89uz89ur3we89u
limits:
    storage: 10G
    bandwidth: 10G

# file
id: 8u58u93w4r890
hash: 8j903r89u89uerw
owner: 89uz89ur3we89u
size: 1_000_000_000
type: image/avif
source: true # whether or not the file is the original file or a converted file like a image preview
priority: 1 # on what type of storage device the file shall resort
children: links to the children files
location: /files/storage/testfile.avif
meta:
    file:
        name: hundebild.avif
    given:
        tags:
            - hund
            - bild

access:
    - 89uzaewdf89zu

# access
id: 89uzaewdf89zu
type: acl
list:
    - 89uz89ur3we89u
claim:
    - read
    - write
    - update
    - delete


```

```json
{
    "_key": "paul",
    "limits": {
        "ssd": {
            "maxStorage": 1000,
            "usedStorage": 0,
            "maxFiles": 1000,
            "usedFiles": 0,
            "maxBandwidth": 0,
            "usedBandwidth": 0
        }
    }
}
```
