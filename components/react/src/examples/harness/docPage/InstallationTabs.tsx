import * as React from "react";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "../../../../lib/components/ui/tabs";
import { CommandBlock } from "./CommandBlock";

interface InstallationTabsProps {
    /** Translated "Command" tab label. */
    readonly commandTabLabel: string;
    /** Translated "Manual" tab label. */
    readonly manualTabLabel: string;
    /** Command body (without the package-manager prefix). */
    readonly command: string;
    /** Manual-mode body — typically a `<ManualSteps>` tree. */
    readonly manual: React.ReactNode;
}

/**
 * Outer Command / Manual tabs used at the top of every doc page's
 * Installation section. The Command tab is a single `<CommandBlock>`;
 * the Manual tab is whatever the consumer composes (usually a
 * `<ManualSteps>`).
 */
export const InstallationTabs = ({
    commandTabLabel,
    manualTabLabel,
    command,
    manual
}: InstallationTabsProps) => (
    <Tabs defaultValue={`command`}>
        <TabsList
            className={`h-auto gap-4 rounded-none border-b border-border bg-transparent p-0 text-muted-foreground`}
        >
            <TabsTrigger
                value={`command`}
                className={`rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2 font-medium data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none`}
            >
                {commandTabLabel}
            </TabsTrigger>
            <TabsTrigger
                value={`manual`}
                className={`rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2 font-medium data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none`}
            >
                {manualTabLabel}
            </TabsTrigger>
        </TabsList>
        <TabsContent value={`command`} className={`mt-4`}>
            <CommandBlock command={command} />
        </TabsContent>
        <TabsContent value={`manual`} className={`mt-4`}>
            {manual}
        </TabsContent>
    </Tabs>
);
