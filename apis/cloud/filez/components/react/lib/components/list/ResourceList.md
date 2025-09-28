# Resource List

A customizable list that handles all basic interactions

## Features

- Drag and drop from list to list if compatible
- Drag and drop in the list for reordering, (only applies when sorting is set to manual)
- infinite virtualized scrolling
- sorting by clicking columns
- user customizable columns (switch columns on or off), developer may set constraints to what columns can be used by the user
- column resizing if renderer is compatible
- keyboard navigation, up down arrow keys, wrap around
- selectable items including ctrl clicking or shift clicking
- keyboard shortcuts to select and handle items, del to delete selected items ctrl+a to select all etc.
- filtering for items, offline when the whole list is loaded or server side when partially loading the list from the server
- different row renderers that can be switched by the user and the ability for the developer to add custom ones
    - Default provided row renderers are:
    - row renderer with rows like you imagine it, with file icons and data from the column, small preview images
    - grid renderer that renders a fixed amount of items per row, with large image/file previews, similar to grid rows in darktable or LR
