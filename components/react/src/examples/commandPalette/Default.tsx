import { useContext, useState } from "react";
import CommandPalette from "../../../lib/components/appShell/commandPalette/CommandPalette";
import { Button } from "../../../lib/components/ui/button";
import { CoreActionIds } from "../../../lib/lib/mowsContext/coreActions";
import { MowsContext } from "../../../lib/lib/mowsContext/MowsContext";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const mowsContext = useContext(MowsContext)!;
    const [open, setOpen] = useState(false);
    useExampleState({ open });

    return (
        <div className={`flex items-center gap-3`}>
            <Button onClick={() => mowsContext.actionManager.dispatchAction(CoreActionIds.OPEN_COMMAND_PALETTE)}>
                Open via core action
            </Button>
            <Button variant={`outline`} onClick={() => setOpen(true)}>
                Open via controlled prop
            </Button>
            <CommandPalette open={open} onOpenChange={setOpen} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.commandPalette.default,
    Example
};

export default module;
