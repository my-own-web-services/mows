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
 * shadcn-docs-style code block for shell commands. Renders the
 * package-manager pills (pnpm / npm / yarn / bun), a terminal-icon
 * affordance, a copy button, and the full command body.
 *
 * Theming: this surface is themed via semantic tokens (bg-card /
 * text-foreground / border-border / bg-muted / bg-accent), so it flips
 * between light and dark with the rest of the docs. Do not reach for
 * literal Tailwind palette colours (`bg-zinc-*`, `bg-gray-*`, …) here —
 * those don't follow the theme and were the cause of the original
 * "install block stays dark in light mode" bug. The repo-wide ESLint
 * rule `no-restricted-syntax` will block such usage in CI.
 */
export const CommandBlock = ({ command, className }: CommandBlockProps) => {
    const [pm, setPm] = React.useState<PackageManager>(`pnpm`);
    const full = buildCommand(pm, command);

    return (
        <div
            className={cn(
                `bg-card text-foreground border-border overflow-hidden rounded-md border`,
                className
            )}
        >
            <div className={`flex items-center gap-2 px-3 py-2`}>
                <span
                    aria-hidden
                    className={`bg-muted text-muted-foreground inline-flex h-6 w-6 shrink-0 items-center justify-center rounded`}
                >
                    <TerminalSquare className={`h-3.5 w-3.5`} />
                </span>
                <Tabs
                    value={pm}
                    onValueChange={(value) => setPm(value as PackageManager)}
                >
                    <TabsList
                        className={`text-muted-foreground h-auto gap-1 rounded-none bg-transparent p-0`}
                    >
                        {PACKAGE_MANAGERS.map((p) => (
                            <TabsTrigger
                                key={p}
                                value={p}
                                className={`text-muted-foreground hover:text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground rounded px-2 py-0.5 font-mono text-sm transition-colors data-[state=active]:shadow-none`}
                            >
                                {p}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
                <CopyValueButton
                    value={full}
                    className={`text-muted-foreground hover:bg-accent hover:text-accent-foreground ml-auto h-6 w-6`}
                />
            </div>
            <pre
                className={`border-border text-foreground overflow-x-auto border-t px-4 py-3 font-mono text-sm`}
            >
                <code>{full}</code>
            </pre>
        </div>
    );
};

export default CommandBlock;
