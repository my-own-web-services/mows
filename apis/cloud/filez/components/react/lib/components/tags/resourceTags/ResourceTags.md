# ResourceTags

Bulk tag editor for any filez resource set. Renders a chip cloud (Badges
mode) or a free-form text area (Text mode) and emits a `ResourceTagsChangeset`
describing every add/remove edit the user committed. Mounts inside a
`<FilezProvider>` and consumes `MowsContext` for translations.

## Modes

| `pickerMode` | When to use                                    | UI                                                             |
| ------------ | ---------------------------------------------- | -------------------------------------------------------------- |
| `"Badges"`   | One row per `(key, value)` tag, multi-resource | Chip per tag with × remove + an "add tag" input + search popover |
| `"Text"`     | Power-user multi-line editing                  | `<Textarea>` whose lines parse back into `(key=value)` tags     |

Switch via the `<ButtonSelect>` in the header. Defaults to `"Badges"` if
`defaultPickerMode` is omitted.

A tag chip carries a "not-all-resources" suffix
(`RESOURCE_TAGS_NOT_ALL_RESOURCES_SUFFIX` from `lib/constants`) when the
underlying tag is present on a subset of `tagsMap` keys — committing then
either propagates the tag to every resource (Add) or removes it from each
(Remove).

## Props

| Prop                 | Type                                                     | Notes                                                            |
| -------------------- | -------------------------------------------------------- | ---------------------------------------------------------------- |
| `tagsMap`            | `Record<resourceId, { key; value }[]>` (required)        | Current tags per resource; the component diffs against this on commit. |
| `resourceType`       | `TagResourceType` (required)                             | Filez-client enum (File, FileGroup, etc.). Forwarded to `searchHandler`. |
| `onCommit`           | `(changes: ResourceTagsChangeset) => void`               | Called when the user commits via Save. See payload shape below.  |
| `searchHandler`      | `(q: TagSearchQuery) => TagSearchResponse`               | Resolves the typeahead. If omitted, the search popover is hidden. |
| `defaultPickerMode`  | `"Badges" \| "Text"`                                     | Initial mode. Mode switches are uncontrolled.                    |
| `className` / `style`| `string` / `CSSProperties`                               | Forwarded to the outer wrapper.                                  |

## Commit payload

```ts
interface ResourceTagsChangeset {
    resourceIds: string[];               // ids the user edited
    add:    { key: string; value: string }[];
    remove: { key: string; value: string }[];
    resourceType: TagResourceType;
}
```

`add` and `remove` are diffs vs. the `tagsMap` prop at the time of commit —
the component does not call the filez API itself. Wire `onCommit` to your
filez client's `updateTags` mutation.

## Constants

`RESOURCE_TAGS_KEY_VALUE_SEPARATOR` (`=`), `RESOURCE_TAGS_SEPARATOR`
(newline), and `RESOURCE_TAGS_NOT_ALL_RESOURCES_SUFFIX` (` *`) live in
`@/lib/constants`. Override only if your serialization needs change.

## Example

```tsx
<FilezProvider client={client}>
    <ResourceTags
        resourceType={TagResourceType.File}
        tagsMap={{
            "f-1": [{ key: "city", value: "Berlin" }],
            "f-2": [{ key: "city", value: "Berlin" }, { key: "rating", value: "5" }]
        }}
        searchHandler={({ searchTerm, resourceType }) =>
            client.api.searchTags({ resource_type: resourceType, q: searchTerm })
        }
        onCommit={(changeset) =>
            client.api.updateTags({
                add: changeset.add,
                remove: changeset.remove,
                resource_ids: changeset.resourceIds,
                resource_type: changeset.resourceType
            })
        }
    />
</FilezProvider>
```
