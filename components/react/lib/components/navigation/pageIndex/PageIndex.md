# PageIndex

"On this page" navigation — a sticky right-rail / top-section list of
in-page anchors. Items map 1:1 to elements on the page by `id`; clicking
an item smooth-scrolls to the matching section and updates the URL hash.

## Behaviour

- Click → `scrollTo({ behavior: "smooth" })` to the target's top minus
  `scrollOffset` (default 80 px). The URL hash is updated via
  `history.replaceState` — back button steps out of the page rather than
  unwinding TOC clicks.
- On mount, if the URL already names a section, the page jumps to it
  **instantly** (`behavior: "auto"`, one `requestAnimationFrame` deferred
  so the targets have mounted). A deep-linked load should land at the
  target immediately; only user clicks animate.
- A scroll listener tracks which section's top edge sits closest to the
  scroll offset; that item gets `aria-current="location"` and a
  primary-coloured left border. Falls back to the first item while the
  page is scrolled above the first section.
- Empty `items` array → renders `null`.

## Translations

Heading + ariaLabel default to the values in
`MowsContext.t.pageIndex.{ heading, ariaLabel }`. Override per-instance
via the `heading` / `ariaLabel` props; pass `heading={null}` to hide the
heading entirely.

If no `<MowsProvider>` is mounted (e.g. in isolated unit tests), the
component falls back to English defaults so it always renders something.

## Props

| Prop           | Type                            | Default                  | Notes                                                                   |
| -------------- | ------------------------------- | ------------------------ | ----------------------------------------------------------------------- |
| `items`        | `ReadonlyArray<PageIndexItem>`  | required                 | `{ id, label, children? }`; `id` must match a DOM element's `id`.       |
| `scrollOffset` | `number`                        | `80`                     | Pixels of headroom above the active section.                            |
| `heading`      | `ReactNode \| null`             | `t.pageIndex.heading`    | Heading rendered above the list. `null` hides it.                       |
| `ariaLabel`    | `string`                        | `t.pageIndex.ariaLabel`  | Accessible name on the `<nav>`.                                         |
| `className`    | `string`                        | —                        | Extra classes on the `<nav>`.                                           |

## Nesting

`PageIndexItem` accepts an optional `children` array of further
`PageIndexItem` entries. Nested items render as an indented sub-list under
their parent; each nesting level adds 12 px of left padding. The scrollspy
treats every id in the tree the same — nesting is presentation only, not
behaviour.

```tsx
<PageIndex
    items={[
        { id: "install", label: "Installation" },
        {
            id: "examples",
            label: "Examples",
            children: [
                { id: "ex-line",     label: "Line" },
                { id: "ex-vertical", label: "Vertical" }
            ]
        },
        { id: "api", label: "API Reference" }
    ]}
/>
```

## Example

```tsx
import { PageIndex } from "@my-own-web-services/react-components";

<div className="flex gap-6">
    <div className="flex-1 flex flex-col gap-6">
        <Card id="section-account">…</Card>
        <Card id="section-profile">…</Card>
        <Card id="section-review">…</Card>
    </div>
    <aside className="sticky top-4 w-48 self-start">
        <PageIndex
            items={[
                { id: "section-account", label: "Account" },
                { id: "section-profile", label: "Profile" },
                { id: "section-review",  label: "Review" }
            ]}
        />
    </aside>
</div>
```

## Notes

- ID generation and uniqueness are the consumer's responsibility. Prefix
  with a stable namespace if multiple `<PageIndex>` instances coexist on
  one page (e.g. `example-horizontal`, not just `horizontal`).
- `scrollToSection(id, offset?)` is exported for callers that want to
  trigger the same scroll behaviour without rendering the nav itself.
