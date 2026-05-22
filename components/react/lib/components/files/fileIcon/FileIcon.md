# FileIcon

Renders a Material file icon for a given filename. Resolution is delegated
to the upstream [`vscode-material-icons`](https://github.com/matejchalk/vscode-material-icons)
package — a wrapper around [vscode-material-icon-theme](https://github.com/material-extensions/vscode-material-icon-theme)
that ships both the resolver and the SVG asset set. We don't fork or
maintain the icon data: filename → icon name comes from `getIconForFilePath`,
icon name → URL comes from a Vite glob over the package's
`generated/icons/` directory.

## Props

| Prop        | Type            | Notes                                                            |
| ----------- | --------------- | ---------------------------------------------------------------- |
| `fileName`  | `string`        | Plain filename or full path; upstream handles basename extraction.|
| `size`      | `number`        | Pixel size for the rendered `<img>`. Defaults to `24`.           |
| `className` | `string`        |                                                                  |
| `style`     | `CSSProperties` |                                                                  |

## States

- **Found** — `<img>` referencing the bundled SVG URL (real icon for the
  resolved name, or the upstream `file` default for unknown extensions).
- **Icon name not in map** — `lookupIconUrl` returned `null` because the
  name `getIconForFilePath` produced isn't in `iconUrlMap`. Falls back to
  the lucide `File` glyph without firing an `<img>` `onError`. Indicates
  the virtual `mows-file-icons` module didn't ship that name — check
  `vite-plugins/fileIconsVirtual.ts` (likely the icon set was bumped and
  the virtual module's cache is stale).
- **Image load error** — lucide `File` glyph as a hard fallback when the
  `<img>` itself fails (e.g. the asset went missing post-build). The
  component goes from "Found" to this state on the `<img onError>`
  callback and stays there until `fileName` changes.

## Assets

The package ships ~910 SVGs under `node_modules/vscode-material-icons/generated/icons/`.
A small Vite plugin in this repo (`vite-plugins/fileIconsVirtual.ts`) scans
that directory at plugin-load time and exposes a `virtual:mows-file-icons`
module containing a single `Record<icon-name, data-URL>` map. The plugin
runs in both the dev server and the library build, so the published bundle
inlines every icon as a URI-encoded data URL. **Consumers do not need to
ship the icons themselves** — the URLs in the bundle are self-contained.
The virtual-module approach replaced an earlier `import.meta.glob(...,
{ query: "?url", eager: true })` call that expanded into ~910 individual
`?url` module requests on every dev-server page load, stalling the docs
on cold start.

## Examples

The blocks below are kept in sync with the docs — every example lives in
`src/examples/fileIcon/<Mode>.tsx` and is rendered through `<ExamplePage>`
on the FileIcon page.

### Common file types — `Default`

Resolution by exact filename (`Dockerfile`, `package.json`, `.gitignore`,
`README.md`) and by extension (`.ts`, `.tsx`, `.css`, `.png`, `.zip`,
`.pdf`).

```tsx
import FileIcon from "@mows/react-components/components/files/fileIcon/FileIcon";

const FILES = [
    "app.ts",
    "app.tsx",
    "styles.css",
    "README.md",
    "package.json",
    "Dockerfile",
    ".gitignore",
    "photo.png",
    "archive.zip",
    "notes.pdf"
];

export const Default = () => (
    <div className="flex flex-wrap gap-4">
        {FILES.map((fileName) => (
            <div
                key={fileName}
                className="flex w-24 flex-col items-center gap-2 rounded-md border p-3"
            >
                <FileIcon fileName={fileName} size={32} />
                <span className="text-xs text-muted-foreground">{fileName}</span>
            </div>
        ))}
    </div>
);
```

### Sizes — `Sizes`

The `size` prop sets both width and height; the underlying SVG scales
without quality loss.

```tsx
import FileIcon from "@mows/react-components/components/files/fileIcon/FileIcon";

const SIZES = [16, 24, 32, 48, 64, 96];

export const Sizes = () => (
    <div className="flex flex-wrap items-end gap-6">
        {SIZES.map((size) => (
            <div key={size} className="flex flex-col items-center gap-2">
                <FileIcon fileName="app.ts" size={size} />
                <span className="text-xs text-muted-foreground">{size}px</span>
            </div>
        ))}
    </div>
);
```

### Unknown extensions — `Fallback`

Upstream `getIconForFilePath` always returns a valid icon name; unknown
extensions resolve to the generic `file` icon. The lucide `File` glyph
fallback only fires if the SVG asset itself fails to load.

```tsx
import FileIcon from "@mows/react-components/components/files/fileIcon/FileIcon";

const UNKNOWN = ["thing.unknownext", "noext", "weirdfile.zzz"];

export const Fallback = () => (
    <div className="flex flex-wrap gap-4">
        {UNKNOWN.map((fileName) => (
            <div
                key={fileName}
                className="flex w-32 flex-col items-center gap-2 rounded-md border p-3"
            >
                <FileIcon fileName={fileName} size={32} />
                <span className="text-xs text-muted-foreground">{fileName}</span>
            </div>
        ))}
    </div>
);
```

## Notes

- Updating the icon set means bumping `vscode-material-icons`. No local
  data file to regenerate.
- If you need direct access to the resolver, import from `vscode-material-icons`
  (`getIconForFilePath`, `getIconForDirectoryPath`, `MATERIAL_ICONS`,
  `MaterialIcon`).
