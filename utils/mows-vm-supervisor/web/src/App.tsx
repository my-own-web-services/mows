import CommandPalette from "mows-components-react/components/atoms/commandPalette/CommandPalette";
import GlobalContextMenu from "mows-components-react/components/atoms/globalContextMenu/GlobalContextMenu";
import ModalHandler from "mows-components-react/components/atoms/modalHandler/ModalHandler";
import PrimaryMenu from "mows-components-react/components/atoms/primaryMenu/PrimaryMenu";
import { useMows } from "mows-components-react/lib/mowsContext/MowsContext";
import { BrowserRouter, Link, Route, Routes, useLocation } from "react-router-dom";
import VmDetail from "./pages/VmDetail";
import VmList from "./pages/VmList";

const Header = () => {
    const location = useLocation();
    const { t } = useMows();
    const onDetail = location.pathname.startsWith("/vms/");
    return (
        <header className="border-border bg-card sticky top-0 z-10 flex items-center justify-between border-b px-6 py-3">
            <div className="flex items-center gap-4">
                <Link to="/" className="text-foreground text-sm font-semibold">
                    {t.supervisor.appName}
                </Link>
                {onDetail && (
                    <Link
                        to="/"
                        className="text-muted-foreground hover:text-foreground text-sm"
                    >
                        {t.supervisor.navAllVms}
                    </Link>
                )}
            </div>
            <span className="text-muted-foreground font-mono text-xs">
                {t.supervisor.connectedTo}: {window.location.host}
            </span>
        </header>
    );
};

const App = () => (
    <div className="bg-background text-foreground min-h-screen w-full">
        <BrowserRouter>
            <Header />
            <main className="w-full">
                <Routes>
                    <Route path="/" element={<VmList />} />
                    <Route path="/vms/:id" element={<VmDetail />} />
                </Routes>
            </main>
            {/*
              Standard mows-components-react mounts. Required by every MOWS
              frontend; the four below give the app a working primary menu
              (theme/language/keyboard shortcuts/login), a global Ctrl-K
              command palette, modal stacking, and right-click context
              menus across the page.
            */}
            <PrimaryMenu />
            <CommandPalette />
            <ModalHandler />
            <GlobalContextMenu />
        </BrowserRouter>
    </div>
);

export default App;
