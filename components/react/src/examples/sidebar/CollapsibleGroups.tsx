import { Bot, ChevronRight, Terminal } from "lucide-react";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from "../../../lib/components/ui/collapsible";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
    SidebarProvider
} from "../../../lib/components/ui/sidebar";
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
    useExampleState({ pattern: `Collapsible + SidebarMenuSub`, groups: groups.length });

    return (
        <div className={`relative h-[420px] overflow-hidden rounded-md border`}>
            <SidebarProvider defaultOpen className={`min-h-0`}>
                <Sidebar className={`absolute`}>
                    <SidebarContent>
                        <SidebarGroup>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {groups.map(({ label, Icon, defaultOpen, items }) => (
                                        <Collapsible
                                            key={label}
                                            defaultOpen={defaultOpen}
                                            className={`group/collapsible`}
                                        >
                                            <SidebarMenuItem>
                                                <CollapsibleTrigger asChild>
                                                    <SidebarMenuButton>
                                                        <Icon />
                                                        <span>{label}</span>
                                                        <ChevronRight
                                                            className={`ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90`}
                                                        />
                                                    </SidebarMenuButton>
                                                </CollapsibleTrigger>
                                                <CollapsibleContent>
                                                    <SidebarMenuSub>
                                                        {items.map((item) => (
                                                            <SidebarMenuSubItem key={item}>
                                                                <SidebarMenuSubButton
                                                                    href={`#`}
                                                                >
                                                                    {item}
                                                                </SidebarMenuSubButton>
                                                            </SidebarMenuSubItem>
                                                        ))}
                                                    </SidebarMenuSub>
                                                </CollapsibleContent>
                                            </SidebarMenuItem>
                                        </Collapsible>
                                    ))}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    </SidebarContent>
                </Sidebar>
            </SidebarProvider>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.sidebar.collapsibleGroups,
    Example
};

export default module;
