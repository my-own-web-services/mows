import { EXAMPLE_ACTION_SCOPE } from "../../exampleActions";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

// <GlobalContextMenu> is mounted globally by the demo app's <MowsProvider>
// shell. Any descendant carrying data-actionscope="<scope>" hijacks the
// native context menu and opens the registered actions for that scope.

const Example = () => {
    useExampleState({ scope: EXAMPLE_ACTION_SCOPE });

    return (
        <div
            data-actionscope={EXAMPLE_ACTION_SCOPE}
            className={`flex h-40 items-center justify-center rounded-md border-2 border-dashed text-sm text-muted-foreground`}
        >
            Right-click anywhere in this box.
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.globalContextMenu.default,
    Example
};

export default module;
