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
    SidebarProvider
} from "../../../lib/components/ui/sidebar";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ appearance: `flush`, defaultOpen: true });

    return (
        <div className={`relative h-[360px] overflow-hidden rounded-md border`}>
            <SidebarProvider defaultOpen appearance={`flush`} className={`min-h-0`}>
                <Sidebar collapsible={`icon`} className={`absolute`}>
                    <SidebarHeader>
                        <span className={`px-2 text-sm font-semibold`}>mows-app</span>
                    </SidebarHeader>
                    <SidebarContent>
                        <SidebarGroup>
                            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {[`Dashboard`, `Files`, `Console`].map(
                                        (label) => (
                                            <SidebarMenuItem key={label}>
                                                <SidebarMenuButton
                                                    isActive={label === `Dashboard`}
                                                >
                                                    {label}
                                                </SidebarMenuButton>
                                            </SidebarMenuItem>
                                        )
                                    )}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    </SidebarContent>
                    <SidebarFooter>
                        <span className={`px-2 text-xs text-muted-foreground`}>
                            v0.0.1
                        </span>
                    </SidebarFooter>
                </Sidebar>
            </SidebarProvider>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.sidebar.flush,
    Example
};

export default module;
