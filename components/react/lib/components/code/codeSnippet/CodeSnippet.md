# CodeSnippet

Renders short pieces of code with the same tokenization and theme that
`CodeViewer` uses — but **without mounting a Monaco editor**. Internally
it lazily bootstraps Monaco + Shiki via the package's
`ensureShikiMonacoReady` bridge so the Shiki TextMate grammars and
themes are registered with Monaco first, then calls
`monaco.editor.colorize(code, language, { tabSize: 4 })`, which returns
an HTML string of pre-tokenized `<span class="mtkN">` elements that
Monaco's injected theme stylesheet colorizes. The output is also passed
through a `safeColorizedHtml` guard that escapes the source if any
active-content tag ever appears in Monaco's output (defense in depth —
see SECURITY-21).

The wrapping element carries the `monaco-editor <themeId>` class pair so
Monaco's CSS rules scope correctly. The current theme comes from
`MowsContext.currentCodeTheme`.

## Why not just `<code>`?

- Plain `<code>` doesn't give you tokens or theme-consistent colors.
- Mounting a full `<CodeViewer>` for a one-liner pulls the editor chrome
  (gutter, scrollbars, minimap, language services). Overkill for a snippet.
- `CodeSnippet` reuses Monaco's tokenizer only. The package is lazy-loaded:
  consumers that never render a snippet don't pay for Monaco.

## Props

| Prop        | Type                         | Notes                                                                       |
| ----------- | ---------------------------- | --------------------------------------------------------------------------- |
| `code`      | `string` (required)          | Source text to render.                                                      |
| `language`  | `CodeViewerLanguage`         | Monaco language id. Defaults to `text` (no coloring).                       |
| `mode`      | `"block" \| "inline"`        | `block` = `<pre>` (default); `inline` = `<code>` chip with newlines collapsed. |
| `className` | `string`                     |                                                                             |
| `style`     | `CSSProperties`              |                                                                             |

## Examples

The blocks below mirror `src/examples/codeSnippet/<Mode>.tsx` and render
through `<ExamplePage>` on the demo page.

### Multi-line block — `Block`

The default mode. Preserves newlines and indentation; suitable for short
illustrative snippets inside a `<div>` or card.

```tsx
import CodeSnippet from "mows-components-react/components/code/codeSnippet/CodeSnippet";

const SAMPLE = `const greet = (name: string) => {
    console.log(\`Hello, \${name}!\`);
};

greet("world");`;

export const Block = () => <CodeSnippet language="typescript" code={SAMPLE} />;
```

### Inline in prose — `Inline`

`mode="inline"` renders a styled `<code>` chip that sits inside a sentence.
Whitespace is collapsed so the snippet stays on a single line regardless of
the source.

```tsx
import CodeSnippet from "mows-components-react/components/code/codeSnippet/CodeSnippet";

export const Inline = () => (
    <p>
        Wrap your app with{" "}
        <CodeSnippet
            mode="inline"
            language="tsx"
            code={`<MowsProvider storagePrefix="myapp">`}
        />
        {" "}and read context via{" "}
        <CodeSnippet
            mode="inline"
            language="typescript"
            code={`static contextType = MowsContext;`}
        />
        .
    </p>
);
```

### Languages — `Languages`

Same component, different Monaco language ids. `text` falls back to
monospaced text with no token coloring.

```tsx
import CodeSnippet from "mows-components-react/components/code/codeSnippet/CodeSnippet";

export const Languages = () => (
    <div className="flex flex-col gap-4">
        <CodeSnippet language="typescript" code={`interface Greeter { greet(name: string): string }`} />
        <CodeSnippet language="json" code={`{ "name": "mows", "deps": ["react", "vite"] }`} />
        <CodeSnippet language="yaml" code={`services:\n  api:\n    image: filez:latest`} />
        <CodeSnippet language="javascript" code={`const sum = (a, b) => a + b;`} />
        <CodeSnippet language="text" code={`no syntax highlighting here`} />
    </div>
);
```

## Notes

- The theme stylesheet is injected by Monaco on the first `setTheme` call
  for a given id; subsequent CodeSnippet renders reuse those rules.
- Tokenization is async (`colorize` returns a Promise). During the brief
  window before tokens resolve, the raw `code` text is shown so the snippet
  is always readable.
- Bundle: Monaco itself (lazy-loaded by both `CodeViewer` and `CodeSnippet`)
  is a single shared chunk. Adding `CodeSnippet` to a page that already
  uses `CodeViewer` adds nothing measurable.
