import { useContext } from "react";
import ModalHandler from "../../../lib/components/appShell/modalHandler/ModalHandler";
import { Button } from "../../../lib/components/ui/button";
import { CoreActionIds } from "../../../lib/lib/mowsContext/coreActions";
import { MowsContext } from "../../../lib/lib/mowsContext/MowsContext";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const ctx = useContext(MowsContext)!;
    useExampleState({ currentlyOpen: ctx.currentlyOpenModal });

    return (
        <div className={`flex flex-wrap gap-2`}>
            <Button onClick={() => ctx.actionManager.dispatchAction(CoreActionIds.OPEN_THEME_SELECTOR)}>
                Theme
            </Button>
            <Button onClick={() => ctx.actionManager.dispatchAction(CoreActionIds.OPEN_LANGUAGE_SETTINGS)}>
                Language
            </Button>
            <Button onClick={() => ctx.actionManager.dispatchAction(CoreActionIds.OPEN_KEYBOARD_SHORTCUTS)}>
                Shortcuts
            </Button>
            {/* Mounted here to keep the example self-contained. In a real app
                <ModalHandler> is mounted once at the root inside <MowsProvider>. */}
            <ModalHandler />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.modalHandler.default,
    Example
};

export default module;
