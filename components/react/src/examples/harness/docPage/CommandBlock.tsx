import { TerminalSquare } from "lucide-react";
import * as React from "react";
import CopyValueButton from "../../../../lib/components/input/copyValueButton/CopyValueButton";
import {
    Tabs,
    TabsList,
    TabsTrigger
} from "../../../../lib/components/ui/tabs";
import { cn } from "../../../../lib/lib/utils";

const PACKAGE_MANAGERS = [`pnpm`, `npm`, `yarn`, `bun`] as const;
type PackageManager = (typeof PACKAGE_MANAGERS)[number];

/**
 * Builds the fully-formed install command for a given package manager.
 * `suffix` is the form-agnostic tail, e.g. `add mows-components-react`.
 * npm uses `install` rather than `add` when adding deps; the other PMs
 * accept `add` verbatim.
 */
const buildCommand = (pm: PackageManager, suffix: string): string => {
    if (pm === `npm`) {
        return `npm ${suffix.replace(/^add\b/, `install`)}`;
    }
    return `${pm} ${suffix}`;
};

interface CommandBlockProps {
    /**
     * The command body without the package-manager prefix, e.g.
     * `add mows-components-react` or `dlx some-cli@latest init`.
     */
    readonly command: string;
    readonly className?: string;
}

/**
 * shadcn-docs-style dark code block for shell commands. Renders the
 * package-manager pills (pnpm / npm / yarn / bun), a terminal-icon
 * affordance, a copy button, and the full command body.
 *
 * The dark colours (`bg-zinc-950 / text-zinc-50`) are intentional and
 * apply in both light and dark themes — code blocks read as "terminal"
 * everywhere, which is what shadcn's docs do as well. Using a semantic
 * token here would either invert in dark mode or fail to convey the
 * terminal aesthetic.
 */
export const CommandBlock = ({ command, className }: CommandBlockProps) => {
    const [pm, setPm] = React.useState<PackageManager>(`pnpm`);
    const full = buildCommand(pm, command);

    return (
        <div
            className={cn(
                `overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 text-zinc-50`,
                className
            )}
        >
            <div className={`flex items-center gap-2 px-3 py-2`}>
                <span
                    aria-hidden
                    className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-zinc-800 text-zinc-300`}
                >
                    <TerminalSquare className={`h-3.5 w-3.5`} />
                </span>
                <Tabs
                    value={pm}
                    onValueChange={(value) => setPm(value as PackageManager)}
                >
                    <TabsList
                        className={`h-auto gap-1 rounded-none bg-transparent p-0 text-zinc-400`}
                    >
                        {PACKAGE_MANAGERS.map((p) => (
                            <TabsTrigger
                                key={p}
                                value={p}
                                className={`rounded px-2 py-0.5 font-mono text-sm text-zinc-400 transition-colors hover:text-zinc-200 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-50 data-[state=active]:shadow-none`}
                            >
                                {p}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
                <CopyValueButton
                    value={full}
                    className={`ml-auto h-6 w-6 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50`}
                />
            </div>
            {/*
              * Deliberately a raw `<pre><code>` rather than `<CodeViewer>`:
              * install commands look like terminal output, so we keep the
              * always-dark zinc palette regardless of the user's current
              * Monaco code theme. Using CodeViewer here would leak the
              * theme into a surface that should read as "shell prompt".
              */}
            <pre
                className={`overflow-x-auto border-t border-zinc-800 px-4 py-3 font-mono text-sm text-zinc-200`}
            >
                <code>{full}</code>
            </pre>
        </div>
    );
};

export default CommandBlock;
