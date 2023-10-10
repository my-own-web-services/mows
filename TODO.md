# Nächste Schritte

## 1. Aktuell

-   background job visibility and management
-   Schnellere Suche
-   React Components
    -   Group List
    -   New Group
    -   File List
        -   Sorting
        -   Selecting
        -   Drag and Drop
        -   Different Views
        -   Searching
    -   File Viewer
    -   Metadaten Bearbeitung
    -   Access Control / Sharing
    -   Upload
-   Dateien teilen
    -   An Nutzer
    -   Mit Passwort/Link
        -   Zunächst readonly get

## 2.

-   Dateien teilen mit verschiedenen permissions read/write/update etc.

## 3.

# Concerns

-   Scalability
    -   Slow speed when dealing with larger ammounts of files
        -> creating large ammounts of fake files to test this
        -   Search
        -   Dynamic Groups

# interossea

-   streamline process ✅
-   fix unfinished UI ❌
-   make redirects work ✅
-   check for security problems with remote login
-   maybe use something else than POST request; something that cant be triggered by a rogue form
-   list logged in sessions and option to log them out

# Security

-   check every server function for unallowed access or similar problems +++++
-   think about dos protection
-   fix hyper body to bytes reading arbitrary body lengths into memory
-   switch to hyper 1.0

# Features

## Other

-   hexlerz like blog
-   upload mini spiel browser mit musik aktiv halten
-   files should be able to appear multiple times in manual groups (for example for playlists)
-   wer hat wann zeit app
-   ui library to facilitate the building of apps +++++
-   dummy files for missing tracks in playlist or similar
-   music player with queue etc.
-   addon workers need to rescan files and look for work; retry failed attempts etc. ✅
-   webdav caldav etc.
-   desktop/smartphone sync +++++
-   password manager +++++
-   tracks/map display
-   share image slides
-   offline player for music/video/images
-   seed files via torrent
-   open zip folders
-   display folder structures
-   automatic virtual subgroups/filters to have more easy fine grained sorting
-   better face recognition by only differentiating between people that were present at an event (told by the user)
-   extract stills from video
-   listening parties and synchronized listening and movie watching
-   control media playback on tv or similar from smartphone
-   automatic tagging with face recognition object detection category detection etc
-   alias tags like "night" with searching for the time and similar

## Hard (Theoretical possible because server supports it)

-   user friendship and profile
-   server controlled websocket sessions for live data exchange between clients to facilitate features like synchronized playback or remote controled playback of media on tv
-   search ++++ ✅
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
-   display movie posters instead of thumbnails ✅
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
