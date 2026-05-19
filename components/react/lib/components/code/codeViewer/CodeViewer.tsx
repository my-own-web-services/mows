import { cn } from "@/lib/utils";
import * as React from "react";

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
    /** Editable mode: enables typing, undo/redo, etc. */
    readonly editable?: boolean;
    readonly onCodeChange?: (next: string) => void;
}

// The actual editor (Monaco) is heavy. Splitting it behind `React.lazy`
// means consumers that import `CodeViewer` from the library don't pay the
// Monaco bundle cost in their initial JS — the chunk is fetched only when
// a `<CodeViewer>` first mounts.
const LazyMonacoCodeEditor = React.lazy(() => import(`./MonacoCodeEditor`));

const Fallback = ({
    className,
    style
}: {
    className?: string;
    style?: React.CSSProperties;
}) => (
    <div
        className={cn(
            `CodeViewer bg-muted/40 h-[260px] animate-pulse rounded-md border`,
            className
        )}
        style={style}
        aria-busy={`true`}
    />
);

const CodeViewer = (props: CodeViewerProps) => (
    <React.Suspense fallback={<Fallback className={props.className} style={props.style} />}>
        <LazyMonacoCodeEditor {...props} />
    </React.Suspense>
);

CodeViewer.displayName = `CodeViewer`;

export default CodeViewer;
