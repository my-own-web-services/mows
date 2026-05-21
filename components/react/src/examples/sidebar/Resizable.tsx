import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider
} from "../../../lib/components/ui/sidebar";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({
        resizable: true,
        defaultWidthPx: 240,
        minWidthPx: 160,
        maxWidthPx: 360
    });

    return (
        <div className={`relative h-[360px] overflow-hidden rounded-md border`}>
            <SidebarProvider
                resizable
                defaultWidthPx={240}
                minWidthPx={160}
                maxWidthPx={360}
            >
                <Sidebar className={`absolute`}>
                    <SidebarHeader>
                        <span className={`px-2 text-sm font-semibold`}>
                            Drag the right edge →
                        </span>
                    </SidebarHeader>
                    <SidebarContent>
                        <SidebarGroup>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {[`One`, `Two`, `Three`].map((label) => (
                                        <SidebarMenuItem key={label}>
                                            <SidebarMenuButton>{label}</SidebarMenuButton>
                                        </SidebarMenuItem>
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
    strings: (t) => t.examples.sidebar.resizable,
    Example
};

export default module;
