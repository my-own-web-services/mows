# ResourceList

Virtualised, infinite-scrolling list of arbitrary "resources" (deployments,
jobs, users, products, swatches — anything with a stable `id`). The
presentation is driven by a `ListRowHandler` strategy so the same list
component can render a tight grid, a row table, or any custom layout
without forking. Selection, keyboard navigation, sorting, column control,
drag-and-drop, and infinite paging all live on the base component.

The list is resource-agnostic — it has no built-in concept of files,
folders, or any other concrete domain. Callers pick the resource shape
(an interface extending `BaseResource`), supply a paginated
`getResourcesList` fetcher, and choose one or more row handlers.

## Row handlers

Each handler implements `ListRowHandler<ResourceType>` and tells
`ResourceList` how to render a single row. Two handlers ship today; a
consumer can supply their own.

| Handler                | Layout              | Use case                                              |
| ---------------------- | ------------------- | ----------------------------------------------------- |
| `ColumnListRowHandler` | Table-style columns | Tabular listings. Per-column sort + resize.            |
| `GridListRowHandler`   | Fixed-cell grid     | Image-heavy galleries / cards / colour swatches.       |
| Custom                 | Anything            | Implement `ListRowHandler<T>` and pass via `rowHandlers`. |

Pass more than one handler to `rowHandlers` and the header exposes an
icon picker that lets the user switch layouts at runtime — the list
keeps its scroll position via the InfiniteLoader's stable `itemKey`.

## Selection

- Click → single-select.
- `Ctrl/Cmd + click` → toggle additive.
- `Shift + click` → range-select against the previous anchor.
- `Ctrl/Cmd + A` → select-all.
- Checkbox column (provided by `ColumnListRowHandler` unless
  `hideSelectionCheckboxColumn` is set) is wired to the same selection
  model.

Consumers read selection via `handlers.onSelect(items, last)`; the
internal state is intentionally not exposed as a controlled prop.

## Keyboard

`ColumnListRowHandler`: Up/Down arrow keys move the focus row.
`GridListRowHandler`: Up/Down/Left/Right wrap inside the grid.
Holding shift extends the selection from the anchor.

## Sorting

`ColumnListRowHandler` sorts by clicking a column header. Direction
cycles Ascending → Descending → Neutral; the active field + direction
are passed to `getResourcesList` so the server can return the right
page. Exactly one column may carry a non-Neutral direction at any time.

## Infinite scroll

Backed by `react-window-infinite-loader`. The consumer supplies
`getResourcesList({ fromIndex, limit, sortBy, sortDirection })` which
must resolve to `{ items, totalCount }`. The list calls it as the user
scrolls; the returned `totalCount` drives the scrollbar's overall
height.

## Props

| Prop                    | Type                                                | Notes                                                                                                |
| ----------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `listInstanceId`        | `string` (required)                                 | DOM-unique id used for keyboard / drag-and-drop scoping.                                              |
| `resourceType`          | `string` (required)                                 | Logical name of the resource being listed (e.g. `"deployment"`, `"product"`).                          |
| `rowHandlers`           | `ListRowHandler<T>[]` (required)                    | Available row layouts. Pass more than one to expose the layout picker.                                |
| `initialRowHandler`     | `string` (required)                                 | id of the row handler to render first.                                                                |
| `getResourcesList`      | `(req) => Promise<ListResourceResponseBody<T>>` (required) | Paginated data source. Receives `{ fromIndex, limit, sortBy, sortDirection }`.                  |
| `defaultSortBy`         | `string`                                            | Field name to sort by on first fetch. Defaults to `"CreatedTime"`.                                    |
| `defaultSortDirection`  | `SortDirection`                                     | Initial direction. Defaults to `Descending`.                                                          |
| `handlers`              | `ResourceListHandlers<T>`                           | Optional callbacks: `onSelect`, `onSearch`, `onRefresh`, `onCreateClick`, `onListTypeChange`.          |
| `displayListHeader`     | `boolean`                                           | Hide the header bar (row-handler picker / refresh) when `false`. Defaults to `true`.                  |
| `listHeaderElement`     | `JSX.Element`                                       | Custom content rendered inside the header bar.                                                        |
| `overscanCount`         | `number`                                            | Rows rendered outside the visible window. Defaults to `20`.                                           |
| `dropTargetAcceptsTypes`| `string[]`                                          | Drag-and-drop: which payload types the list accepts as a drop target.                                 |
| `displayDebugBar`       | `boolean`                                           | Show an internal debug bar with the current fetch / window state. Defaults to `false`.                |
| `className` / `style`   | `string` / `CSSProperties`                          | Outer wrapper.                                                                                        |

## Example

```tsx
interface Deployment {
    id: string;
    name: string;
    region: string;
}

const columnHandler = new ColumnListRowHandler<Deployment>({
    columns: [
        {
            field: "name",
            label: "Name",
            direction: SortDirection.Ascending,
            widthPercent: 60,
            minWidthPixels: 140,
            enabled: true,
            render: (d) => <span>{d.name}</span>
        },
        {
            field: "region",
            label: "Region",
            direction: SortDirection.Neutral,
            widthPercent: 40,
            minWidthPixels: 100,
            enabled: true,
            render: (d) => <span>{d.region}</span>
        }
    ]
});

<ResourceList<Deployment>
    listInstanceId="deployments"
    resourceType="deployment"
    rowHandlers={[columnHandler]}
    initialRowHandler={columnHandler.id}
    getResourcesList={async (req) => {
        const r = await api.deployments.list(req);
        return { items: r.items, totalCount: r.totalCount };
    }}
    defaultSortBy="name"
    defaultSortDirection={SortDirection.Ascending}
    handlers={{
        onSelect: (selected, last) => console.log(selected.length, last?.id)
    }}
/>
```
