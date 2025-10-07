# Resource Tags Component

A component to tag a single or multiple resources at once

## Requirements

Examples are for files but the component shall not be limited to files

1. A text only version with a textarea containing comma separated key values pairs like:

`city=augsburg, country=germany`

if multiple items are selected and not all have the same tags an asterisk is added

- file1 selected: `city=augsburg, country=germany`
- file2 selected: `city=münchen, country=germany`
- file1 and file2 selected:`city=augsburg*, city=münchen*, country=germany`

when the asterisk is removed in the textarea the tag is applied to the whole selection of resources

2. An input field to add new tags where tags can be searched and autocompleted
   2.1 A Box with key value pairs as [badges](https://ui.shadcn.com/docs/components/badge) that can be removed with an x or when multiple files are selected also added to all, with a plus
   2.2 The search should be context aware

3. A selector to switch between own tags and tags of other persons
