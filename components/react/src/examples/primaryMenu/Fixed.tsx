import PrimaryMenu from "../../../lib/components/appShell/primaryMenu/PrimaryMenu";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

// `position: fixed` is normally relative to the viewport. Setting `transform`
// on the parent turns that parent into the containing block, so the PrimaryMenu
// pins to this preview region instead of taking over the whole page.
const Example = () => {
    useExampleState({ variant: `fixed`, position: `top-right` });

    return (
        <div
            className={`relative h-48 rounded-md border bg-muted/30`}
            style={{ transform: `translate(0)` }}
        >
            <PrimaryMenu position={`top-right`} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.primaryMenu.fixed,
    Example
};

export default module;
