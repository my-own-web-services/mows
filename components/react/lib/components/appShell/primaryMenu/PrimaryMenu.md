# PrimaryMenu

The app-shell user / settings dropdown. Reads identity from `MowsContext`
(`auth.isAuthenticated`, `authConfigured`) and provides login/logout, language,
theme, code theme, keyboard-shortcut editor, and settings entries. Apps pass
the resolved user via the `user` prop and may add app-specific entries via
`extraItems`.

## Variants

`variant?: "fixed" | "inline"` — default `"fixed"`.

### `fixed` (default)

Free-floating dropdown anchored to a screen corner. Use this when the app does
not have a sidebar, or when the menu should overlay the layout. Position is
controlled with `position` (`top-right` | `top-left` | `bottom-right` |
`bottom-left`, default `top-right`). Mount once near the root of the app, as a
sibling of the main layout — not inside it.

```tsx
<PrimaryMenu position="top-right" user={{ displayName, id }} />
```

### `inline`

Renders as a full-width row, trigger left-aligned, with the dropdown opening
upward (`side="top" align="start"`). Designed to live inside a `SidebarFooter`.

- **Logged in:** small avatar + display name + up/down chevron.
- **Logged out:** menu icon + up/down chevron (no visible label;
  `primaryMenu.openMenu` lives on the trigger's `title` attribute for
  tooltip / a11y).

The whole bar is one button: hover, focus, and "menu open" all flip the
wrapper's background via CSS `:has(button…)`, so the entire footer area
lights up — not just the inner trigger. In this mode the burger icon does
not own its own per-icon hover; the wrapper drives the highlight. The
`fixed` variant is the opposite: it's a free-floating circular trigger with
no wrapper highlight, so the icon keeps its own `hover:text-foreground`.

No fixed positioning — the variant relies on its parent for layout, so do not
add `position` when using `inline`.

```tsx
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarProvider
} from "@mows/react-components/components/ui/sidebar";
import PrimaryMenu from "@mows/react-components/components/appShell/primaryMenu/PrimaryMenu";

<SidebarProvider>
    <Sidebar>
        <SidebarContent>{/* nav */}</SidebarContent>
        <SidebarFooter>
            <PrimaryMenu variant="inline" user={{ displayName, id }} />
        </SidebarFooter>
    </Sidebar>
    {/* main content */}
</SidebarProvider>;
```

When the sidebar layout is driven by `ResizablePanelGroup` instead of the
shadcn `Sidebar` body (the supervisor pattern), put the inline `PrimaryMenu`
at the bottom of the same flex column that owns the sidebar `Resi­zablePanel`'s
contents — not as a sibling of `ResizablePanelGroup`.

## Props summary

| Prop             | Type                                     | Notes                                                              |
| ---------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| `variant`        | `"fixed" \| "inline"`                    | Default `"fixed"`.                                                  |
| `position`       | `"top-right" \| "top-left" \| "bottom-right" \| "bottom-left"` | Only meaningful when `variant="fixed"`.   |
| `user`           | `{ displayName?, id? }`                  | Source of truth for the trigger label and the "copy user id" item. |
| `loading`        | `boolean`                                | When true, renders nothing — use while the identity is resolving.  |
| `showSwitchUser` | `boolean`                                | Adds a "Switch user" item when logged in.                          |
| `extraItems`     | `ReactNode`                              | Appended at the bottom of the dropdown body.                       |
| `defaultOpen`    | `boolean`                                | Mostly for tests/storybook.                                         |

## Notes

- Mount exactly one `<PrimaryMenu>` at a time — every instance registers
  the global `OPEN_PRIMARY_MENU` action handler under the same id
  (`GlobalOpenPrimaryMenu`), so the most recently mounted instance wins
  and the dispatch flips arbitrarily based on render order. Use the
  `variant` prop (`"fixed"` / `"inline"`) instead of two mounts to
  support different layouts.
- Translations come from `t.primaryMenu`; the inline variant does not introduce
  new strings.
- Do not wrap the trigger or content in raw HTML controls — extend behavior
  through `extraItems` or open a new modal via `mowsContext.changeActiveModal`.
