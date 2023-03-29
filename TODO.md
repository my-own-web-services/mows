# interossea

-   streamline process ✅
-   fix unfinished UI ❌

# Security

-   check every server function for unallowed access or similar problems +++++
-   think about dos protection
-   fix hyper body to bytes reading arbitrary body lengths into memory

# Features

## Other

-   webdav caldav etc.
-   desktop/smartphone sync
-   password manager
-   tracks/map display
-   share image slides
-   offline player for music/video/images
-   seed files via torrent
-   open zip folders

## Hard (Theoretical possible because server supports it)

-   search ++++
-   add search effort option to search request
-   caching of requests/searches
-   dynamic groups +++
-   access control +++++
-   traffic limits
-   upload spaces
-   calculate checksum of file readonly files and different checksums than the default sha256 on request
-   encrypted files first party e2e encryption with browser access and decryption
-   only return required fields when requesting a file list
-   addons data maybe should affect users storage limits

## Soft (Ease of use and looks)

### web

-   keyboard control
-   proper use of icons
-   drag and drop to add to groups
-   better tag editing
-   icons for files in list
-   display movie posters instead of thumbnails
-   image preview resolution switching based on inner window width ✅
-   zoomable images like in old imagein with high resolution splitting https://sharp.pixelplumbing.com/api-output#tile
-   expandable groups
-   group icons
-   always display mime types even if they are not known ✅
-   right panel: display group properties
-   save video wathc progress
-   download files ✅
-   right panel display multiple files
-   export files
-   access control editor +++
-   search
-   display group names instead of ids in the static group window when inspecting a file
-   transfer file ownership
-   switch between original and transcoded video
-   proper video controls resolution selection etc.
-   sorting of files in list and grid with sorting on any chosen property
-   create components for easy use with other filez uis
-   display more metadata from files directly in the properties panel
-   multiple file select
-   delete file
-   delete group
-   proper text file viewer
-   face area highlighting display and create for images
-   video preview thumbnail switching or display moving video previews instead of thumbnails like on some adult sites
-   preload things where possible if on unthrottled connection
-   fix re render on every click in grid

# Deployment

## docker-compose with mozart

-   non root deployment
-   better network assignment (maybe with mozart)
