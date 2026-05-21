import { useMows } from "@/lib/mowsContext/MowsContext";
import { cn } from "@/lib/utils";
import Editor, { loader, type Monaco, type OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import * as React from "react";
import type { CodeViewerProps } from "./CodeViewer";
import { ensureShikiMonacoReady, isSupportedThemeId, SHIKI_THEME_NAME } from "./shikiBridge";
import {
    estimateFitContentHeight,
    MONACO_LINE_HEIGHT_PX
} from "./metrics";

// Wire @monaco-editor/react to the bundled monaco-editor package instead of
// the public CDN. Without this, the loader injects a remote script tag
// which violates `script-src 'self'` CSPs and blocks the entire editor.
loader.config({ monaco });

// Asynchronously wire shiki (real TextMate tokenizer) into Monaco. The
// promise is awaited inside the editor mount handler so the first paint
// has correctly-scoped tokens. We also kick it off eagerly so that the
// inline `MonacoColorizer` (which colorizes async too) gets a head
// start.
void ensureShikiMonacoReady(monaco);

// Monaco's worker bootstrap. Vite's `?worker` import suffix produces a
// constructor that builds a Worker from a same-origin chunk, which complies
// with `script-src 'self'` (and `worker-src 'self'`). We type the global
// hook through Monaco's own `Environment` interface so a future Monaco
// upgrade that reshapes the contract fails to compile rather than
// silently mis-wiring workers.
declare global {
    // eslint-disable-next-line no-var
    var MonacoEnvironment: monaco.Environment | undefined;
}
if (!globalThis.MonacoEnvironment) {
    globalThis.MonacoEnvironment = {
        getWorker(_moduleId: string, label: string) {
            if (label === `json`) return new jsonWorker();
            return new editorWorker();
        }
    };
}

// JS/TS/HTML/CSS language services needlessly run validation that requires
// `unsafe-eval` and a heavy worker for our viewer use case. Disable them.
// The `monaco.languages.typescript` namespace is typed as `{ deprecated:
// true }` from `monaco-editor` 0.55+, but the runtime still exposes the
// defaults objects on it — cast through `any` so optional access continues
// to compile while the suppression still applies.
const monacoTypescriptNs = (monaco.languages as { typescript?: unknown })
    .typescript as
    | {
          javascriptDefaults?: { setDiagnosticsOptions?: (o: unknown) => void };
          typescriptDefaults?: { setDiagnosticsOptions?: (o: unknown) => void };
      }
    | undefined;
monacoTypescriptNs?.javascriptDefaults?.setDiagnosticsOptions?.({
    noSemanticValidation: true,
    noSyntaxValidation: true
});
monacoTypescriptNs?.typescriptDefaults?.setDiagnosticsOptions?.({
    noSemanticValidation: true,
    noSyntaxValidation: true
});

const monacoLanguageFor = (lang: CodeViewerProps[`language`]): string => {
    switch (lang) {
        case `json`:
            return `json`;
        case `yaml`:
            return `yaml`;
        case `javascript`:
            return `javascript`;
        case `typescript`:
            return `typescript`;
        case `jsx`:
            return `jsx`;
        case `tsx`:
            return `tsx`;
        case `text`:
        default:
            return `plaintext`;
    }
};

const MonacoCodeEditor = (props: CodeViewerProps) => {
    const mowsContext = useMows();
    const editorDefaults = mowsContext?.codeEditorSettings;

    const {
        className,
        style,
        code,
        language = `text` as CodeViewerProps[`language`],
        showLineNumbers = editorDefaults?.showLineNumbers ?? true,
        wrap = editorDefaults?.wrap ?? true,
        showWhitespace = editorDefaults?.showWhitespace ?? true,
        bracketPairColorization = editorDefaults?.bracketPairColorization ?? true,
        editable = false,
        onCodeChange,
        fitContent = false,
        revealLine
    } = props;

    // Defence-in-depth: once `shikiToMonaco()` runs it replaces Monaco's
    // theme dispatch with one that throws "Theme `X` not found" for any
    // name not registered with shiki. A stale localStorage value, a
    // misconfigured `codeThemes` prop, or a future regression must never
    // be able to crash the entire page — fall back to the always-present
    // shiki theme and warn, instead of letting the error bubble up.
    const requestedThemeId =
        (mowsContext?.currentCodeTheme?.monacoThemeId as string | undefined) ?? SHIKI_THEME_NAME;
    const themeId = isSupportedThemeId(requestedThemeId)
        ? requestedThemeId
        : (console.warn(
              `[CodeViewer] Unknown code theme "${requestedThemeId}", ` +
                  `falling back to "${SHIKI_THEME_NAME}". ` +
                  `Check that lib/lib/codeThemes.ts and ` +
                  `lib/components/code/codeViewer/shikiHighlighter.ts ` +
                  `agree on the theme list.`
          ),
          SHIKI_THEME_NAME);

    // Suspend editor mount until shiki + the TextMate tokens provider
    // have been wired into Monaco. Otherwise the first paint comes back
    // uncolored and Monaco doesn't auto-retokenize when the provider is
    // installed later. This is a one-time async cost (~oniguruma WASM +
    // grammar JSON); subsequent mounts resolve synchronously.
    const [shikiReady, setShikiReady] = React.useState(false);
    React.useEffect(() => {
        let cancelled = false;
        ensureShikiMonacoReady(monaco).then(() => {
            if (!cancelled) setShikiReady(true);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    const editorRef = React.useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const decorationsRef = React.useRef<string[]>([]);

    // Centre the editor on `revealLine` and decorate that line so it
    // stands out (background tint via a global `.mows-revealed-line`
    // rule shipped in main.css). Re-runs when `revealLine` or `code`
    // changes — the latter matters because Monaco replaces the model
    // when code changes and any prior decoration is dropped.
    const applyReveal = React.useCallback(() => {
        const editor = editorRef.current;
        if (!editor) return;
        if (!revealLine || revealLine < 1) {
            decorationsRef.current = editor.deltaDecorations(
                decorationsRef.current,
                []
            );
            return;
        }
        editor.revealLineInCenter(revealLine);
        decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [
            {
                range: new monaco.Range(revealLine, 1, revealLine, 1),
                options: {
                    isWholeLine: true,
                    className: `mows-revealed-line`
                }
            }
        ]);
    }, [revealLine]);

    const handleMount: OnMount = (editor, _m: Monaco) => {
        editorRef.current = editor;
        applyReveal();
    };

    React.useEffect(() => {
        applyReveal();
    }, [applyReveal, code]);

    // In `fitContent` mode the visible word-wrap setting is forced to
    // `off` so the rendered line count equals the source line count.
    // Without this, a single long source line could wrap into N visual
    // lines and Monaco's actual height would diverge from the wrapper
    // height we pre-computed from `code.split("\n").length`. The
    // resulting overflow is hidden by the wrapper's `overflow-hidden`
    // (and the scrollbar is disabled below), which is the trade we make
    // to guarantee zero layout shift between the Suspense skeleton and
    // the mounted editor.
    const effectiveWrap = fitContent ? false : wrap;

    // Monaco uses `automaticLayout: true` for resize tracking, but we still
    // call `layout()` on prop-driven option changes so the gutter / wrap
    // recompute immediately rather than waiting for the next mutation.
    React.useEffect(() => {
        editorRef.current?.layout();
    }, [showLineNumbers, effectiveWrap, showWhitespace, bracketPairColorization, editable]);

    return (
        <div
            className={cn(
                // Monaco computes its initial layout from the parent's
                // height. `min-height` alone leaves the parent at content
                // height (a few px), and `height: 100%` is moot when the
                // grandparent has no definite height. So we set a definite
                // pixel height by default; consumers override with their
                // own `h-…` class via `className` (tailwind-merge picks the
                // last one). `fitContent` opts out of the fixed height and
                // tracks `editor.getContentHeight()` instead.
                fitContent
                    ? `CodeViewer relative overflow-hidden rounded-md border`
                    : `CodeViewer relative h-[260px] overflow-hidden rounded-md border`,
                className
            )}
            style={
                fitContent
                    ? { ...style, height: `${estimateFitContentHeight(code)}px` }
                    : style
            }
        >
            {shikiReady && <Editor
                value={code}
                language={monacoLanguageFor(language)}
                theme={themeId}
                height={`100%`}
                width={`100%`}
                onMount={handleMount}
                onChange={(value) => onCodeChange?.(value ?? ``)}
                options={{
                    readOnly: !editable,
                    automaticLayout: true,
                    lineNumbers: showLineNumbers ? `on` : `off`,
                    wordWrap: effectiveWrap ? `on` : `off`,
                    renderWhitespace: showWhitespace ? `all` : `none`,
                    bracketPairColorization: { enabled: bracketPairColorization },
                    fontFamily: `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, "Cascadia Mono", "Liberation Mono", Consolas, "Courier New", monospace`,
                    fontSize: 14,
                    // Pin the line height and remove all vertical padding
                    // so that Monaco's rendered content height is exactly
                    // `lineCount * MONACO_LINE_HEIGHT_PX` — the same value
                    // the Suspense fallback (and the wrapper) is sized
                    // to. Drift in any of these would reintroduce a
                    // layout shift on lazy-chunk load.
                    lineHeight: MONACO_LINE_HEIGHT_PX,
                    padding: { top: 0, bottom: 0 },
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    // Let wheel events bubble to the surrounding scroll
                    // container when the editor itself has nothing left to
                    // scroll, instead of trapping the user inside the editor.
                    // In fitContent mode we sized to the full content, so
                    // the editor has nothing to scroll — hide its bars
                    // entirely to avoid a thin always-visible track.
                    scrollbar: {
                        alwaysConsumeMouseWheel: false,
                        ...(fitContent
                            ? { vertical: `hidden`, horizontal: `hidden` }
                            : {})
                    },
                    smoothScrolling: true,
                    contextmenu: false,
                    fixedOverflowWidgets: true,
                    quickSuggestions: false,
                    parameterHints: { enabled: false },
                    suggestOnTriggerCharacters: false,
                    folding: editable,
                    glyphMargin: false,
                    occurrencesHighlight: editable ? `singleFile` : `off`,
                    renderLineHighlight: editable ? `line` : `none`
                }}
            />}
        </div>
    );
};

export default MonacoCodeEditor;
