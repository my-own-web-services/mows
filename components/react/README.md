# mows-components-react

Generic React component, context, auth, theme, language, action, hotkey, and
modal library shared by all MOWS frontend apps.

Distributed locally via [yalc](https://github.com/wclr/yalc):

```sh
pnpm build
yalc push
```

## Required app setup

Every consuming app **must** wrap its root in `<MowsProvider>` and mount the
following four components somewhere inside the provider tree. They are part
of the contract — features like Ctrl+Shift+P (command palette), Ctrl+/
(keyboard-shortcut editor), the right-click context menu, and the auth /
theme / language switching flow assume they are present.

| Component                | Purpose                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| `<MowsProvider>`         | Root context. Owns auth (OIDC), theme, language, action manager, hotkey manager, modal manager.          |
| `<PrimaryMenu>`          | The dropdown in the corner of the viewport with login/logout, language, theme, keyboard shortcuts, etc. |
| `<CommandPalette>`       | Ctrl+Shift+P palette listing every registered action, grouped by category.                              |
| `<ModalHandler>`         | Renders core modals (keyboard shortcut editor, theme selector, language selector, dev tools).            |
| `<GlobalContextMenu>`    | Renders right-click menus for any element with a `data-actionscope` attribute.                          |

### Minimal `main.tsx`

```tsx
import ReactDOM from "react-dom/client";
import "mows-components-react/main.css";
import { MowsProvider } from "mows-components-react/lib/mowsContext/MowsContext";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <MowsProvider
        storagePrefix="my-app"
        oidc={{
            issuerUrl: "https://auth.example/realms/my-app",
            clientId: "my-app"
        }}
        languages={languages}
        initialTranslation={initialTranslation}
        extraActions={extraActions}
    >
        <App />
    </MowsProvider>
);
```

`storagePrefix` namespaces all localStorage keys (theme, language, hotkey
config, recent actions, post-login redirect path). It does **not** namespace
the CSS theme class — that is fixed (`theme-light`, `theme-dark`,
`theme-glass-light`, `theme-glass-dark`, …).

### Minimal `App.tsx`

```tsx
import CommandPalette from "mows-components-react/components/atoms/commandPalette/CommandPalette";
import GlobalContextMenu from "mows-components-react/components/atoms/globalContextMenu/GlobalContextMenu";
import ModalHandler from "mows-components-react/components/atoms/modalHandler/ModalHandler";
import PrimaryMenu from "mows-components-react/components/atoms/primaryMenu/PrimaryMenu";

export default class App extends PureComponent {
    render = () => (
        <>
            {/* …your app… */}
            <PrimaryMenu user={{ displayName, id }} />
            <CommandPalette />
            <ModalHandler />
            <GlobalContextMenu />
        </>
    );
}
```

The four components are unconditional — render them once at the root, do
**not** gate them behind authentication or routing.

## Translations

`Translation` is an extensible TypeScript interface. Apps add their own keys
via declaration merging:

```ts
declare module "mows-components-react/lib/languages" {
    interface Translation {
        myApp: { hello: string };
    }
}
```

Provide one file per language that imports the matching mows base, spreads
it, and adds the app's keys. Pass them as `languages` on `<MowsProvider>`.

To avoid a flash of the wrong language on cold start, eagerly import all
translation modules in `main.tsx` and pass the matching one as
`initialTranslation` (look up `${storagePrefix}_language` in localStorage,
fall back to `navigator.language`, then to `en-US`).

## Themes

`defaultThemes` ships System / Light / Dark / Glass Light / Glass Dark. The
selected theme adds a `theme-<id>` class to `<html>`; the lib's `main.css`
defines the CSS variables for each. Apps can append their own
`MowsTheme`s — either inline (more `.theme-<id>` rules in app CSS) or
external (`url:` field, loaded on demand).

## Actions, hotkeys, context menu

- `actionManager.dispatchAction(id)` runs an action from anywhere.
- Apps register additional actions via the `extraActions` prop on
  `MowsProvider`. Every action has a category and one or more handlers; a
  handler with a `scopes: ["myScope"]` entry surfaces in the global context
  menu when the user right-clicks an element with `data-actionscope="myScope"`.
- Default hotkeys can be extended via `extraDefaultHotkeys`. Users can
  rebind any hotkey through the keyboard-shortcut editor reachable from
  `<PrimaryMenu>` or via Ctrl+/.

## Style

- Use only arrow functions where possible (especially in classes).
- All constants live in `lib/lib/constants.ts`.
- Run `pnpm lint:fix` to format files.
- Use semantic Tailwind tokens (`bg-background`, `bg-card`, `text-foreground`),
  never literal colors like `bg-gray-50` — those break custom themes.

## Building & testing

```sh
pnpm build      # vite library build (also full type-check via dts plugin)
pnpm test       # vitest
pnpm lint:fix   # eslint
```

After changes, run `pnpm build && yalc push` to refresh consumers.
