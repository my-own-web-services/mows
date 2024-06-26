-   file/group permissions
-   upload spaces

mongodb://root:root@localhost:27017

# addons

-   video
    -   create thumbnails
    -   create videos that can be skipped through
    -   create adaptive quality video
    -   read metadata
-   audio
    -   create album art
    -   read metadata

TODO never return mime types for files that have text/html or others that may create document context
add security headers (CSP) to api to mitigate issues like that even further

config grows and grows so we may need to create a config/secret service or use vault

# dynamic file groups

```yaml
file1:
    # when anything that can be selected by a selector changes we need to check all groups (of the same owner) if the file belongs in the group
    keywords: tree
    groups: [group1]
file2:
    keywords: bird
    groups: []

# when the selector changes we need to check all files (of the same owner) if their selector is up to date
group1:
    select: all files where one of keywords is tree
```

# file groups

get files in group with groupid

groupId: abc

search for group with id abc

get selector from group

find files that match the selector

get permission of

# sync

create file group

# create some file share

create permission
create file group
apply permission to file group

# other

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

files

users

file groups

```yml
id: randomly generated id
owner: userId
permissions: array of permission ids
```

user groups

```yml
id: randomly generated id
owner: userId
name: friends
```

permissions

we get the userId and the fileId and have to decide if a user can access the file

for single file access get file joined with permission and check params
if multiple permissionIds are set in the array we merge them
if merge conflicts exist we deny access

```yml
id: randomly generated id
name: permission 1
owner: userId
acl:
    everyone:
        read: true
    passwords:
        update: [hashedPassword]
    users:
        delete: [userId]

ribston:
```

for getFilesByGroupId
get fileGroup by id and check permissions; in this case the list permission needs to be fullfilled

if fullfilled get all files matching the group

```yml
id: randomly generated id
name: permission 1
owner: userId
acl:
    everyone:
        list: true
    passwords:
        list: [hashedPassword]
    users:
        list:
            users: [userId]
            userGroups: [userGroupId]

ribston:
```

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
    "_id": "dev",
    "limits": {
        "ssd": {
            "maxStorage": 1000,
            "usedStorage": 0,
            "maxFiles": 1000,
            "usedFiles": 0,
            "maxBandwidth": 0,
            "usedBandwidth": 0
        }
    },
    "appData": {},
    "userGroupIds": []
}
```
