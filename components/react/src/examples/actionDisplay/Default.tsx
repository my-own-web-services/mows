import { useContext } from "react";
import ActionDisplay from "../../../lib/components/actions/actionDisplay/ActionDisplay";
import { MowsContext } from "../../../lib/lib/mowsContext/MowsContext";
import { ExampleActionIds } from "../../exampleActions";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const mowsContext = useContext(MowsContext)!;
    const action = mowsContext.actionManager.getAction(ExampleActionIds.GREET);
    useExampleState({ actionId: ExampleActionIds.GREET, registered: !!action });

    return (
        <div className={`max-w-sm rounded-md border bg-card p-3`}>
            {action ? (
                <ActionDisplay action={action} />
            ) : (
                <span className={`text-muted-foreground text-sm`}>
                    Action not registered in this provider.
                </span>
            )}
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.actionDisplay.default,
    Example
};

export default module;
