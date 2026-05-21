# ConsoleManager

A VSCode-style console host. The component matches VSCode's terminal
panel model and layout 1-for-1 — confirmed against the upstream source
at
[`vs/workbench/contrib/terminal/browser/terminalTabsList.ts`](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/terminal/browser/terminalTabsList.ts)
and [`media/terminal.css`](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/terminal/browser/media/terminal.css):

- The **content area** is on the left. The **tab list** is on the right,
  with a draggable resize handle between them (`ResizableHandle`).
- Every terminal belongs to exactly one **group**. A group is a recursive
  split tree of terminal slots; all the terminals in a group are visible
  side-by-side at the same time (via nested `ResizablePanelGroup`s).
- Switching the active terminal in the tab list **switches which group is
  shown** in the content area. There is no "tabs stacked inside a pane"
  concept — that doesn't exist in VSCode.
- Split siblings within a group share one section in the tab list and
  carry box-drawing prefixes in their label (`┌ `, `├ `, `└ `) — exactly
  what VSCode emits in `renderElement`.

## Layout model

```ts
interface Group {
    id: string;
    layout: LayoutNode; // recursive
}

type LayoutNode = TerminalSlot | SplitNode;

interface TerminalSlot { kind: "terminal"; tabId: string }
interface SplitNode {
    kind: "split";
    direction: "horizontal" | "vertical";
    children: [LayoutNode, LayoutNode];
}
```

The component holds `groups: Group[]`, a single `activeTabId`, and a flat
`tabs: Record<id, Tab>` lookup. The active terminal's group is what
renders in the content area; the other groups stay mounted (kept
`visible/invisible` via CSS) so xterm scrollback / websocket state
survives every switch.

## Layout in the DOM

```
┌───────────────────────────────────────────────────────────────────┐
│                                       │                  [+] [v] │
│                                       ├───────────────────────────┤
│                                       │ │ Terminal 1              │
│   The active group renders here,      │                           │
│   recursively split into its slots    │   ┌ Terminal 2            │
│   via ResizablePanelGroup. Inactive   │ │ ├ Terminal 3            │
│   groups stay mounted but invisible.  │   └ Terminal 4            │
│                                       │                           │
│                                       │   Logs 1                  │
│                                       │                           │
└───────────────────────────────────────────────────────────────────┘
```

The thin `│` to the left of an active row is the 1-px `::before` accent
bar — same approach as VSCode's `.terminal-tabs-entry.is-active::before`
(absolute, `left:0`, `top:0`, `bottom:0`, `width:1px`).

## Props

| Prop                  | Type                          | Notes                                                                              |
| --------------------- | ----------------------------- | ---------------------------------------------------------------------------------- |
| `types`               | `readonly ConsoleType[]`      | Registered console kinds. Order drives the new-terminal menu order.                |
| `defaultTypeId`       | `string`                      | Type opened by the bare `+` button and seeded into split siblings.                  |
| `initialTabs`         | `readonly InitialTab[]`       | One top-level group per seeded entry — same as clicking `+` once per seed.         |
| `tabListDefaultSize`  | `number`                      | Initial right-panel width, percent. Default `22`.                                   |
| `tabListMinSize`      | `number`                      | Min right-panel width, percent. Default `14`.                                       |
| `tabListMaxSize`      | `number`                      | Max right-panel width, percent. Default `45`.                                       |
| `className` / `style` | standard                      | Applied to the outer wrapper (rounded, bordered, full-height).                      |

```ts
interface ConsoleType {
    id: string;
    label: string;
    icon?: LucideIcon;
    render: () => ReactNode;
    defaultName?: (ordinal: number) => string;
}
```

## Interactions

- **New terminal** — toolbar `+` opens `defaultTypeId` as a brand-new
  top-level group. With > 1 type, a chevron next to `+` picks the
  type.
- **Switch terminal** — single-click a row. The active terminal's group
  is what shows in the content area.
- **Rename** — double-click a row. Enter commits, Escape cancels.
  Click outside also commits. Also available from the right-click
  context menu.
- **Split** — hover a row → the `⊞` action button at the right of the
  row adds a sibling terminal **inside the same group** (matches
  VSCode `createTerminal({ location: { parentTerminal: instance } })`).
  Also available from the right-click context menu as **Split
  Terminal**.
- **Kill** — hover a row → the trash icon next to Split closes that
  one terminal. Closing the last terminal of a group drops the group.
  Also available from the right-click context menu as **Kill
  Terminal**.
- **Right-click a row** — `Rename` · `Split Terminal` · `Kill
  Terminal` (mirrors the in-VSCode context menu for terminal rows).
- **Drag-reorder within a group** — drag a row up/down over another
  row. The drop indicator's half (top/bottom) controls whether the
  source ends up as the `before` or `after` child of the resulting
  split.
- **Drag cross-group** — drag a row onto a row in a different group.
  The terminal is plucked from its source group's layout (any
  surrounding `SplitNode` collapses; an empty group is dropped) and
  grafted into the target group as a horizontal split sibling of the
  target row.
- **Resize the tab list** — drag the vertical handle between content
  and tab list.

## Wiring example

```tsx
import { ConsoleManager, LogView, Terminal } from "mows-components-react";
import { ScrollText, TerminalSquare } from "lucide-react";

<ConsoleManager
    types={[
        {
            id: `terminal`,
            label: `Terminal`,
            icon: TerminalSquare,
            render: () => <Terminal />
        },
        {
            id: `logs`,
            label: `Logs`,
            icon: ScrollText,
            render: () => <LogView lines={[]} />
        }
    ]}
    defaultTypeId={`terminal`}
    initialTabs={[{ typeId: `terminal` }]}
    className={`h-96`}
/>;
```

`render` is called once per terminal slot and the result stays mounted
for the slot's lifetime — switching groups, splitting, or moving the
terminal across groups never unmounts the body, so xterm keeps its
scrollback and any websocket-backed console keeps its connection.

## Theming

All colours are theme tokens — no hardcoded values:

- Outer chrome: `bg-background`, `border-border`, `text-foreground`.
- Tab list panel: `bg-sidebar`, `text-sidebar-foreground`.
- Hover row: `bg-sidebar-accent/40` foreground bumped to
  `text-sidebar-foreground`.
- Active row: `bg-sidebar-accent`, `text-sidebar-accent-foreground`,
  plus a 1-px `::before` accent on the left using `bg-primary`.
- Drop indicator: a 2-px `bg-primary` strip above / below the target
  row.
- Group separator: subtle 1-px `border-sidebar-border/50` between
  groups in the tab list (groups don't carry a label header — they're
  defined visually by this divider plus the box-drawing prefix on
  split siblings).

## Defined behaviour

| Statement                                                                                  | Test                                                                                       |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Each seeded `initialTab` becomes its own top-level group (matches VSCode `+`).             | `renders one top-level group per seeded initial tab (VSCode model: + per terminal)`         |
| Toolbar `+` always opens a NEW top-level group, not a sibling.                             | `+ opens a new top-level group (not a tab in an existing group)`                            |
| Per-row split adds a sibling **inside the same group**.                                    | `per-row Split adds a sibling inside the same group (VSCode createTerminal with parentTerminal)` |
| Split siblings carry the VSCode `┌ / ├ / └` box-drawing prefix on their label.             | `split siblings within a group get box-drawing prefixes (┌ … └) just like VSCode's renderElement` |
| Single-terminal groups carry no prefix.                                                    | `single-terminal groups carry no prefix`                                                    |
| Active row carries a 1-px left accent bar via `::before` (matches VSCode terminal.css).    | `active row carries the VSCode-style left accent indicator (::before bar via CSS)`          |
| Killing the active terminal falls back to a sensible neighbour.                            | `hover Kill closes the terminal and falls back to a sensible neighbour`                     |
| Killing the last terminal of a group drops the group entirely.                             | `closing the last terminal in a group drops the group entirely`                             |
| Double-click → rename → Enter commits.                                                     | `double-click → rename → Enter commits the new name`                                        |
| With > 1 type the toolbar shows a chevron picker next to `+`.                              | `shows the type-picker chevron when more than one console type is registered`               |
| All groups' bodies stay mounted so xterm state survives switches.                          | `keeps all group bodies mounted so xterm state survives a group switch`                     |
| Drag a sibling onto another in the same group rewires the split tree.                      | `drag-reorder: dragging a sibling onto another in the same group rewires the split tree`    |
| Drag a terminal across groups collapses the empty source group.                            | `drag cross-group: pulling a terminal out of one group into another collapses the empty source group` |
