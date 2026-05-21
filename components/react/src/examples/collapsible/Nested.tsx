import { Bot, ChevronRight, Terminal } from "lucide-react";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from "../../../lib/components/ui/collapsible";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

interface Group {
    readonly label: string;
    readonly Icon: typeof Terminal;
    readonly defaultOpen: boolean;
    readonly items: ReadonlyArray<string>;
}

const groups: ReadonlyArray<Group> = [
    {
        label: `Playground`,
        Icon: Terminal,
        defaultOpen: true,
        items: [`History`, `Starred`, `Settings`]
    },
    {
        label: `Models`,
        Icon: Bot,
        defaultOpen: true,
        items: [`Genesis`, `Explorer`]
    }
];

const Example = () => {
    useExampleState({ pattern: `Collapsible + nested items + vertical accent`, groups: groups.length });

    return (
        <ul className={`flex w-72 flex-col gap-1 rounded-md border bg-card p-2`}>
            {groups.map(({ label, Icon, defaultOpen, items }) => (
                <li key={label}>
                    <Collapsible defaultOpen={defaultOpen} className={`group/collapsible`}>
                        <CollapsibleTrigger
                            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent`}
                        >
                            <Icon className={`size-4 shrink-0 opacity-80`} />
                            <span>{label}</span>
                            <ChevronRight
                                className={`ml-auto size-4 opacity-60 transition-transform group-data-[state=open]/collapsible:rotate-90`}
                            />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <ul
                                className={`ml-3.5 flex flex-col gap-1 border-l border-border px-2.5 py-1`}
                            >
                                {items.map((item) => (
                                    <li key={item}>
                                        <a
                                            href={`#`}
                                            className={`block rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-foreground`}
                                        >
                                            {item}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </CollapsibleContent>
                    </Collapsible>
                </li>
            ))}
        </ul>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.collapsible.nested,
    Example
};

export default module;
