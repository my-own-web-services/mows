import { CheckCircle2, Loader2 } from "lucide-react";
import * as React from "react";
import CodeViewer from "../../../../lib/components/code/codeViewer/CodeViewer";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from "../../../../lib/components/ui/dialog";
import { cn } from "../../../../lib/lib/utils";
import { renderDescription } from "./renderInlineMarkup";

export interface BehaviourEntry {
    /** Human-readable statement of expected behaviour. */
    readonly statement: React.ReactNode;
    /** File path of the test that verifies the statement, e.g. `lib/components/.../*.test.tsx`. */
    readonly testFile: string;
    /** Line number within `testFile` where the test starts. */
    readonly testLine: number;
    /** Test name (the string passed to `it("…")`). */
    readonly testName: string;
}

interface BehaviourListProps {
    readonly entries: ReadonlyArray<BehaviourEntry>;
    /** Translated "verified by" label. */
    readonly verifiedByLabel: string;
    readonly className?: string;
}

// All `*.test.tsx` files under `lib/` are pulled in lazily via Vite's
// `import.meta.glob`. Each entry is a factory that resolves to the raw
// file contents, so clicking a behaviour row only loads the test it
// actually points at — no upfront cost for the dozens of other tests.
// The glob is anchored at the project root (`/lib/**`) so the keys
// produced match `BehaviourEntry.testFile` exactly (caller-side strings
// are already rooted at `lib/...`, we just prepend the leading slash).
const TEST_SOURCES = import.meta.glob<string>(`/lib/**/*.test.{ts,tsx}`, {
    query: `?raw`,
    import: `default`
});

interface DialogState {
    readonly entry: BehaviourEntry;
    /** `null` while loading, `string` once resolved, `Error` on failure. */
    readonly source: string | null | Error;
}

export const BehaviourList = ({ entries, verifiedByLabel, className }: BehaviourListProps) => {
    const [dialog, setDialog] = React.useState<DialogState | null>(null);

    const openEntry = React.useCallback((entry: BehaviourEntry) => {
        setDialog({ entry, source: null });
        const key = entry.testFile.startsWith(`/`)
            ? entry.testFile
            : `/${entry.testFile}`;
        const loader = TEST_SOURCES[key];
        if (!loader) {
            setDialog({
                entry,
                source: new Error(`Test source not found: ${entry.testFile}`)
            });
            return;
        }
        loader()
            .then((source) => {
                // Bail if the user closed/changed the dialog before the
                // import resolved — otherwise a slow load would steal
                // focus / content from a more recent click.
                setDialog((current) =>
                    current && current.entry === entry
                        ? { entry, source }
                        : current
                );
            })
            .catch((err: unknown) => {
                setDialog((current) =>
                    current && current.entry === entry
                        ? {
                              entry,
                              source: err instanceof Error ? err : new Error(String(err))
                          }
                        : current
                );
            });
    }, []);

    return (
        <>
            <ul className={cn(`flex flex-col gap-3`, className)}>
                {entries.map((entry) => (
                    <li
                        key={`${entry.testFile}:${entry.testLine}`}
                        className={`flex items-start gap-3 rounded-md border bg-card p-4`}
                    >
                        <CheckCircle2
                            aria-hidden
                            className={`mt-0.5 h-5 w-5 shrink-0 text-primary`}
                        />
                        <div className={`flex min-w-0 flex-1 flex-col gap-2 text-sm`}>
                            <p className={`leading-snug text-foreground`}>
                                {renderDescription(entry.statement)}
                            </p>
                            {/*
                             * Only the path:line chip is the interactive
                             * trigger — the "verified by" prefix and the
                             * test-name suffix sit alongside it as static
                             * context so the hit target matches the
                             * code-styled token the user reads as a link.
                             */}
                            <p
                                className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-muted-foreground`}
                            >
                                <span className={`shrink-0 uppercase tracking-wide`}>
                                    {verifiedByLabel}
                                </span>
                                <button
                                    type={`button`}
                                    onClick={() => openEntry(entry)}
                                    aria-label={`Show test source: ${entry.testName}`}
                                    className={`cursor-pointer rounded bg-muted px-1.5 py-0.5 font-mono text-[0.7rem] text-foreground hover:bg-background hover:underline focus-visible:bg-background focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                                >
                                    {`${entry.testFile}:${entry.testLine}`}
                                </button>
                                <span
                                    className={`min-w-0 truncate italic`}
                                    title={entry.testName}
                                >
                                    {`"${entry.testName}"`}
                                </span>
                            </p>
                        </div>
                    </li>
                ))}
            </ul>
            <BehaviourSourceDialog state={dialog} onOpenChange={(open) => {
                if (!open) setDialog(null);
            }} />
        </>
    );
};

interface DialogProps {
    readonly state: DialogState | null;
    readonly onOpenChange: (open: boolean) => void;
}

const BehaviourSourceDialog = ({ state, onOpenChange }: DialogProps) => (
    <Dialog open={state !== null} onOpenChange={onOpenChange}>
        <DialogContent
            // The default DialogContent caps width at sm; bump to a code-
            // friendly width so a test fits without horizontal-scrolling
            // its own contents. Height is capped so a long test scrolls
            // inside the editor rather than the modal.
            className={`flex max-w-[min(96vw,1100px)] flex-col gap-3 p-0 sm:max-w-[min(96vw,1100px)]`}
        >
            <DialogHeader className={`px-6 pt-6`}>
                <DialogTitle className={`flex items-baseline gap-2 text-base`}>
                    {state && (
                        <>
                            <span className={`truncate italic font-normal`}>
                                {`"${state.entry.testName}"`}
                            </span>
                        </>
                    )}
                </DialogTitle>
                <DialogDescription
                    className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs`}
                >
                    {state && (
                        <code
                            className={`rounded bg-muted px-1.5 py-0.5 font-mono text-[0.7rem] text-foreground`}
                        >
                            {`${state.entry.testFile}:${state.entry.testLine}`}
                        </code>
                    )}
                </DialogDescription>
            </DialogHeader>
            <div className={`flex min-h-0 flex-1 flex-col px-6 pb-6`}>
                {state === null ? null : state.source === null ? (
                    <div
                        className={`flex h-[60vh] items-center justify-center gap-2 rounded-md border bg-muted/30 text-sm text-muted-foreground`}
                    >
                        <Loader2 className={`h-4 w-4 animate-spin`} aria-hidden />
                        <span>{`Loading test source…`}</span>
                    </div>
                ) : state.source instanceof Error ? (
                    <div
                        className={`flex h-[60vh] items-center justify-center rounded-md border border-destructive/40 bg-destructive/5 px-6 text-center text-sm text-destructive`}
                    >
                        {state.source.message}
                    </div>
                ) : (
                    <CodeViewer
                        code={state.source}
                        language={`tsx`}
                        revealLine={state.entry.testLine}
                        showLineNumbers
                        wrap={false}
                        showWhitespace={false}
                        className={`h-[60vh]`}
                    />
                )}
            </div>
        </DialogContent>
    </Dialog>
);
