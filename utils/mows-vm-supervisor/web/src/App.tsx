// Bare app shell. Layout is split-pane via shadcn's `Resizable` primitive
// (react-resizable-panels): sidebar on the left, main content on the right,
// resizable divider in between. Persistence + double-click-reset come
// from `<ResizablePanelGroup autoSaveId>` and the wrapper in
// mows-components-react's `ResizableHandle`.

import CommandPalette from "mows-components-react/components/appShell/commandPalette/CommandPalette";
import GlobalContextMenu from "mows-components-react/components/appShell/globalContextMenu/GlobalContextMenu";
import ModalHandler from "mows-components-react/components/appShell/modalHandler/ModalHandler";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup
} from "mows-components-react/components/ui/resizable";
import { SidebarProvider } from "mows-components-react/components/ui/sidebar";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import ModalHost from "./components/ModalHost";
import Sidebar from "./components/Sidebar";
import VmDetail from "./pages/VmDetail";

const Home = () => (
    <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        Select a VM from the sidebar to see its details.
    </div>
);

const App = () => (
    <BrowserRouter>
        {/* SidebarProvider stays so `useSidebar()` inside SidebarMenuButton etc.
            still resolves; its own layout is bypassed by ResizablePanelGroup. */}
        <SidebarProvider className="bg-background text-foreground h-screen min-h-0">
            <ResizablePanelGroup
                direction="horizontal"
                autoSaveId="mows-vm-supervisor:layout"
                className="h-screen"
            >
                <ResizablePanel
                    id="sidebar"
                    order={1}
                    defaultSize={20}
                    minSize={12}
                    maxSize={45}
                    className="bg-sidebar border-sidebar-border border-r"
                >
                    <Sidebar />
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel id="main" order={2}>
                    <main className="h-full overflow-y-auto">
                        <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/vms/:id" element={<VmDetail />} />
                        </Routes>
                    </main>
                </ResizablePanel>
            </ResizablePanelGroup>
            {/* PrimaryMenu is embedded inside `<Sidebar />` via
                `<SidebarFooter><PrimaryMenu variant="inline" /></SidebarFooter>`
                so it scrolls with the sidebar instead of floating over the
                main content. */}
            <CommandPalette />
            <ModalHandler />
            <ModalHost />
            <GlobalContextMenu />
        </SidebarProvider>
    </BrowserRouter>
);

export default App;
