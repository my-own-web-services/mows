# ResourceList

Virtualised, infinite-scrolling list of arbitrary "resources" (files, jobs,
agents, …). The presentation is driven by a `ListRowHandler` strategy so the
same list component can render a tight grid, a row table, or any custom
layout without forking. Selection, keyboard navigation, sorting, column
control, drag-and-drop, and infinite paging all live on the base component.

## Row handlers

Each handler implements `ListRowHandler<ResourceType>` and tells
`ResourceList` how to render a single row. Three handlers ship today; a
consumer can supply their own.

| Handler                | Layout              | Use case                                              |
| ---------------------- | ------------------- | ----------------------------------------------------- |
| `ColumnListRowHandler` | Table-style columns | Default file/folder listing. Per-column sort + resize. |
| `GridListRowHandler`   | Fixed-cell grid     | Image-heavy galleries (filez file grid, etc.).         |
| Custom                 | Anything            | Implement `ListRowHandler<T>` and pass via `rowHandlers`. |

Switching handler at runtime is one prop assignment — the list keeps its
scroll position via the InfiniteLoader's stable `itemKey`.

## Selection

- Click → single-select.
- `Ctrl/Cmd + click` → toggle additive.
- `Shift + click` → range-select against the previous anchor.
- `Ctrl/Cmd + A` → select-all (current page only — paged loads remain
  unselected until they paint).
- Checkbox column (provided by `ColumnListRowHandler`) is wired to the same
  selection model.

The consumer reads selection via the `onSelectionChange` callback; the
internal state is intentionally not exposed as a controlled prop (forces
the selection model to live in one place).

## Keyboard

Up/Down arrow keys move the focus row; the list wraps top↔bottom. Enter
fires the row's primary action (`onRowActivate`). The handler may add
extra bindings via `getKeyBindings(row)`.

## Sorting

`ColumnListRowHandler` sorts by clicking a column header (`sort: "asc" |
"desc" | "manual"`). Setting sort to `"manual"` enables drag-reorder
within the list. Cross-list drag is supported when both lists declare a
compatible `dragDropContext`.

## Infinite scroll

Backed by `react-window-infinite-loader`. The consumer supplies
`loadMoreRows({ startIndex, stopIndex })` returning a promise; the list
calls it as the user scrolls. `itemCount` should be the *known* total
once the server reports it, or `current.length + 1` until then so the
loader keeps requesting.

## Props

| Prop                    | Type                                              | Notes                                                                   |
| ----------------------- | ------------------------------------------------- | ----------------------------------------------------------------------- |
| `items`                 | `ReadonlyArray<ResourceType>` (required)          | The loaded slice. The list does not paginate internally.                |
| `itemCount`             | `number` (required)                               | Total number of items including unloaded ones.                          |
| `loadMoreRows`          | `(range) => Promise<void>` (required)             | Called when an unloaded index is about to render.                       |
| `rowHandler`            | `ListRowHandler<ResourceType>` (required)         | Drives rendering — Column, Grid, or custom.                              |
| `rowHandlers`           | `ListRowHandler<ResourceType>[]`                  | Optional set the user can switch between via the header menu.            |
| `onSelectionChange`     | `(ids: string[]) => void`                         | Fires whenever selection changes (single-select, range, ctrl/cmd, etc.). |
| `onRowActivate`         | `(item: ResourceType) => void`                    | Fires on Enter or double-click.                                          |
| `getRowId`              | `(item: ResourceType) => string`                  | Stable key for selection + memoisation. Defaults to `item.id`.           |
| `dragDropContext`       | `string`                                          | Compatible lists with the same context accept cross-list drag.           |
| `className` / `style`   | `string` / `CSSProperties`                        | Outer wrapper.                                                           |

## Example

```tsx
<ResourceList
    items={files}
    itemCount={totalFiles}
    loadMoreRows={({ startIndex, stopIndex }) =>
        client.listFiles({ from: startIndex, to: stopIndex }).then((page) =>
            setFiles((prev) => [...prev, ...page.items])
        )
    }
    rowHandler={columnHandler}
    rowHandlers={[columnHandler, gridHandler]}
    onSelectionChange={setSelectedIds}
    onRowActivate={(file) => openFile(file.id)}
/>
```

## Notes for filez consumers

The filez React package ships `Column.test.tsx` and `ResourceList.test.tsx`
integration tests under `apis/cloud/filez/components/react/lib/components/list/`
that verify the Column row handler under a real `FilezProvider`. The list
component itself lives in `mows-components-react`; filez never re-implements
it.
