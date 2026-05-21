import { cn } from "@/lib/utils";
import * as React from "react";

/** Imperative handle exposed by `<Terminal ref={...}>`. */
export interface TerminalHandle {
    /** Write raw bytes / a string into the terminal. */
    write: (data: string | Uint8Array) => void;
    /** Convenience: write the string + a CRLF. */
    writeln: (data: string | Uint8Array) => void;
    /** Clear the visible buffer. */
    clear: () => void;
    /** Focus the terminal so it receives keyboard input. */
    focus: () => void;
    /** Force a refit to the current container size. */
    fit: () => void;
}

export interface TerminalProps {
    readonly className?: string;
    readonly style?: React.CSSProperties;
    /** Called for every keypress / paste the user produces. */
    readonly onData?: (data: string) => void;
    /** Called whenever xterm recomputes its grid (cols/rows). */
    readonly onResize?: (cols: number, rows: number) => void;
    /**
     * Called once after the xterm chunk has loaded and the terminal is
     * mounted — useful for writing an initial banner / prompt without
     * waiting on a separate mount effect from the consumer.
     */
    readonly onReady?: (handle: TerminalHandle) => void;
    /** Default font size in px. Default: 13. */
    readonly fontSize?: number;
}

// xterm.js + its CSS are large (~250 KB minified). Splitting the actual
// implementation behind `React.lazy` means consumers that import
// `Terminal` from the library don't pay the xterm bundle cost in their
// initial JS — the chunk is fetched only when a `<Terminal>` first
// mounts. Same pattern as `CodeViewer` for Monaco.
const LazyXtermTerminal = React.lazy(() => import(`./XtermTerminal`));

const Fallback = ({
    className,
    style
}: {
    className?: string;
    style?: React.CSSProperties;
}) => (
    <div
        className={cn(
            `Terminal bg-muted/40 h-full w-full animate-pulse rounded-md border`,
            className
        )}
        style={style}
        aria-busy={`true`}
    />
);

const Terminal = React.forwardRef<TerminalHandle, TerminalProps>((props, ref) => (
    <React.Suspense
        fallback={<Fallback className={props.className} style={props.style} />}
    >
        <LazyXtermTerminal {...props} ref={ref} />
    </React.Suspense>
));

Terminal.displayName = `Terminal`;

export default Terminal;
export { Terminal };
