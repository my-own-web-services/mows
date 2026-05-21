import { cn } from "@/lib/utils";
import * as React from "react";
import { estimateFitContentHeight } from "./metrics";
import { getShikiHighlighter } from "./shikiHighlighter";

// Kick off the shiki highlighter at module-eval time. `CodeViewer` is in
// the eager bundle (every doc page imports it), so the JS regex engine +
// grammar JSON chunks start downloading the moment the page loads —
// long before the lazy `MonacoCodeEditor` chunk arrives. By the time
// `<Editor>` mounts the highlighter is hot and the editor paints with
// correct token colors on first frame.
void getShikiHighlighter();

export type CodeViewerLanguage =
    | `json`
    | `javascript`
    | `typescript`
    | `jsx`
    | `tsx`
    | `yaml`
    | `text`;

export interface CodeViewerProps {
    readonly className?: string;
    readonly style?: React.CSSProperties;
    readonly code: string;
    readonly language?: CodeViewerLanguage;
    /** Show line numbers in the gutter. Default: from MowsContext (true). */
    readonly showLineNumbers?: boolean;
    /** Wrap long lines instead of horizontal scroll. Default: from MowsContext (true). */
    readonly wrap?: boolean;
    /** Render dot/arrow markers for spaces and tabs. Default: from MowsContext (true). */
    readonly showWhitespace?: boolean;
    /** Colorize matching bracket pairs in increasing depth colors. Default: from MowsContext (true). */
    readonly bracketPairColorization?: boolean;
    /** Editable mode: enables typing, undo/redo, etc. */
    readonly editable?: boolean;
    readonly onCodeChange?: (next: string) => void;
    /**
     * When true, the wrapper sizes itself to Monaco's content height so
     * the editor shows every line without an internal scrollbar. Useful
     * for snippets meant to be shown in full (e.g. inside an
     * `<ExpandableCode>` collapsed/expanded container).
     */
    readonly fitContent?: boolean;
    /**
     * If set, after mount scroll the editor so this 1-based line is
     * centred in the viewport and add a subtle line highlight via a
     * `revealed-line` Monaco decoration. Re-running the prop updates
     * both the scroll position and the decoration. Useful for "jump to
     * test line N" surfaces.
     */
    readonly revealLine?: number;
}

// The actual editor (Monaco) is heavy. Splitting it behind `React.lazy`
// means consumers that import `CodeViewer` from the library don't pay the
// Monaco bundle cost in their initial JS — the chunk is fetched only when
// a `<CodeViewer>` first mounts.
const LazyMonacoCodeEditor = React.lazy(() => import(`./MonacoCodeEditor`));

interface FallbackProps {
    readonly className?: string;
    readonly style?: React.CSSProperties;
    readonly fitContent?: boolean;
    readonly code: string;
}

const Fallback = ({ className, style, fitContent, code }: FallbackProps) => (
    <div
        className={cn(
            `CodeViewer bg-muted/40 animate-pulse rounded-md border`,
            !fitContent && `h-[260px]`,
            className
        )}
        style={
            fitContent
                ? { ...style, height: `${estimateFitContentHeight(code)}px` }
                : style
        }
        aria-busy={`true`}
    />
);

const CodeViewer = (props: CodeViewerProps) => (
    <React.Suspense
        fallback={
            <Fallback
                className={props.className}
                style={props.style}
                fitContent={props.fitContent}
                code={props.code}
            />
        }
    >
        <LazyMonacoCodeEditor {...props} />
    </React.Suspense>
);

CodeViewer.displayName = `CodeViewer`;

export default CodeViewer;
