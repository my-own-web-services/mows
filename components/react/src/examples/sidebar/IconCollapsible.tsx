import { Folder, Home, Settings } from "lucide-react";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarTrigger
} from "../../../lib/components/ui/sidebar";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

interface Entry {
    readonly label: string;
    readonly Icon: typeof Home;
}

const entries: ReadonlyArray<Entry> = [
    { label: `Dashboard`, Icon: Home },
    { label: `Files`, Icon: Folder },
    { label: `Settings`, Icon: Settings }
];

const Example = () => {
    useExampleState({ collapsible: `icon`, trigger: `SidebarTrigger` });

    return (
        <div className={`relative h-[360px] overflow-hidden rounded-md border`}>
            <SidebarProvider defaultOpen className={`min-h-0`}>
                <Sidebar collapsible={`icon`} className={`absolute`}>
                    <SidebarHeader className={`flex-row items-center justify-between`}>
                        <span
                            className={`px-2 text-sm font-semibold group-data-[collapsible=icon]:hidden`}
                        >
                            mows-app
                        </span>
                        <SidebarTrigger title={`Toggle sidebar`} />
                    </SidebarHeader>
                    <SidebarContent>
                        <SidebarGroup>
                            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {entries.map(({ label, Icon }) => (
                                        <SidebarMenuItem key={label}>
                                            <SidebarMenuButton tooltip={label}>
                                                <Icon />
                                                <span>{label}</span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    ))}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    </SidebarContent>
                    <SidebarFooter>
                        <span
                            className={`px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden`}
                        >
                            v0.0.1
                        </span>
                    </SidebarFooter>
                </Sidebar>
            </SidebarProvider>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.sidebar.iconCollapsible,
    Example
};

export default module;
