import { useMows } from "@/lib/mowsContext/MowsContext";
import { cn } from "@/lib/utils";
import Editor, { loader, type Monaco, type OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import * as React from "react";
import type { CodeViewerProps } from "./CodeViewer";

// Wire @monaco-editor/react to the bundled monaco-editor package instead of
// the public CDN. Without this, the loader injects a remote script tag
// which violates `script-src 'self'` CSPs and blocks the entire editor.
loader.config({ monaco });

// Monaco's worker bootstrap. Vite's `?worker` import suffix produces a
// constructor that builds a Worker from a same-origin chunk, which complies
// with `script-src 'self'` (and `worker-src 'self'`).
interface MonacoEnvironmentWorker {
    getWorker(_moduleId: string, label: string): Worker;
}

const win = globalThis as unknown as {
    MonacoEnvironment?: MonacoEnvironmentWorker;
};
if (!win.MonacoEnvironment) {
    win.MonacoEnvironment = {
        getWorker(_moduleId: string, label: string) {
            if (label === `json`) return new jsonWorker();
            return new editorWorker();
        }
    };
}

// JS/TS/HTML/CSS language services needlessly run validation that requires
// `unsafe-eval` and a heavy worker for our viewer use case. Disable them.
monaco.languages.typescript?.javascriptDefaults?.setDiagnosticsOptions?.({
    noSemanticValidation: true,
    noSyntaxValidation: true
});
monaco.languages.typescript?.typescriptDefaults?.setDiagnosticsOptions?.({
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
            return `javascript`;
        case `tsx`:
            return `typescript`;
        case `text`:
        default:
            return `plaintext`;
    }
};

const MonacoCodeEditor = (props: CodeViewerProps) => {
    const ctx = useMows();
    const editorDefaults = ctx?.codeEditorSettings;

    const {
        className,
        style,
        code,
        language = `text` as CodeViewerProps[`language`],
        showLineNumbers = editorDefaults?.showLineNumbers ?? true,
        wrap = editorDefaults?.wrap ?? true,
        showWhitespace = editorDefaults?.showWhitespace ?? true,
        editable = false,
        onCodeChange
    } = props;

    const themeId =
        (ctx?.currentCodeTheme?.monacoThemeId as string | undefined) ?? `vs-dark`;

    const editorRef = React.useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

    const handleMount: OnMount = (editor, _m: Monaco) => {
        editorRef.current = editor;
    };

    // Monaco uses `automaticLayout: true` for resize tracking, but we still
    // call `layout()` on prop-driven option changes so the gutter / wrap
    // recompute immediately rather than waiting for the next mutation.
    React.useEffect(() => {
        editorRef.current?.layout();
    }, [showLineNumbers, wrap, showWhitespace, editable]);

    return (
        <div
            className={cn(
                // Monaco computes its initial layout from the parent's
                // height. `min-height` alone leaves the parent at content
                // height (a few px), and `height: 100%` is moot when the
                // grandparent has no definite height. So we set a definite
                // pixel height by default; consumers override with their
                // own `h-…` class via `className` (tailwind-merge picks the
                // last one).
                `CodeViewer relative h-[260px] overflow-hidden rounded-md border`,
                className
            )}
            style={style}
        >
            <Editor
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
                    wordWrap: wrap ? `on` : `off`,
                    renderWhitespace: showWhitespace ? `all` : `none`,
                    bracketPairColorization: { enabled: true },
                    fontFamily: `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, "Cascadia Mono", "Liberation Mono", Consolas, "Courier New", monospace`,
                    fontSize: 14,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    // Let wheel events bubble to the surrounding scroll
                    // container when the editor itself has nothing left to
                    // scroll, instead of trapping the user inside the editor.
                    scrollbar: { alwaysConsumeMouseWheel: false },
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
            />
        </div>
    );
};

export default MonacoCodeEditor;
