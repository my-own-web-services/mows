import PrimaryMenu from "../../../lib/components/appShell/primaryMenu/PrimaryMenu";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ variant: `inline`, user: `Ada Lovelace` });

    return (
        <div className={`max-w-xs rounded-md border bg-card`}>
            <PrimaryMenu variant={`inline`} user={{ displayName: `Ada Lovelace` }} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.primaryMenu.inline,
    Example
};

export default module;
