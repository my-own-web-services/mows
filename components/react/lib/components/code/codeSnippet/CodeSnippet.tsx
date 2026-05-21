import { cn } from "@/lib/utils";
import * as React from "react";
import type { CodeViewerLanguage } from "../codeViewer/CodeViewer";

export interface CodeSnippetProps {
    readonly className?: string;
    readonly style?: React.CSSProperties;
    /** The code to render. Trimmed at the leading/trailing edge for inline mode. */
    readonly code: string;
    /**
     * Language id forwarded to Monaco's tokenizer. Defaults to `text` (no
     * highlighting) — pick a real language for inline tokens like `const x = 1`.
     */
    readonly language?: CodeViewerLanguage;
    /**
     * Render mode.
     * - `block` (default): wraps in `<pre>`, preserves newlines, monospace font,
     *   subtle card background. Use for snippets that span multiple lines or
     *   want their own visual block.
     * - `inline`: wraps in `<code>` styled as an inline chip; sits inside a
     *   paragraph or sentence. Newlines are collapsed.
     */
    readonly mode?: `block` | `inline`;
}

// Monaco is heavy. Splitting CodeSnippet's tokenizer behind `React.lazy` keeps
// the cost out of consumers that don't render snippets, and lets CodeSnippet
// share Monaco with CodeViewer if both are loaded on the same page.
const LazyMonacoColorizer = React.lazy(() => import(`./MonacoColorizer`));

const FallbackBlock = ({
    code,
    className,
    style
}: {
    code: string;
    className?: string;
    style?: React.CSSProperties;
}) => (
    <pre
        className={cn(
            `CodeSnippet overflow-auto rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm`,
            className
        )}
        style={style}
    >
        {code}
    </pre>
);

const FallbackInline = ({
    code,
    className,
    style
}: {
    code: string;
    className?: string;
    style?: React.CSSProperties;
}) => (
    <code
        className={cn(
            `CodeSnippet inline-block rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[0.92em]`,
            className
        )}
        style={style}
    >
        {code}
    </code>
);

const CodeSnippet = (props: CodeSnippetProps) => {
    const { mode = `block`, code, className, style } = props;
    const Fallback = mode === `inline` ? FallbackInline : FallbackBlock;
    return (
        <React.Suspense
            fallback={<Fallback code={code} className={className} style={style} />}
        >
            <LazyMonacoColorizer {...props} />
        </React.Suspense>
    );
};

CodeSnippet.displayName = `CodeSnippet`;

export default CodeSnippet;
