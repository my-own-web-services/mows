import KeyComboDisplay from "../../../lib/components/actions/keyComboDisplay/KeyComboDisplay";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({});

    return (
        <div className={`flex flex-wrap items-center gap-3`}>
            <KeyComboDisplay keyCombo={`mod+k`} />
            <KeyComboDisplay keyCombo={`mod+shift+p`} />
            <KeyComboDisplay keyCombo={`alt+enter`} />
            <KeyComboDisplay keyCombo={`escape`} />
            <KeyComboDisplay keyCombo={`shift+arrowup`} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.keyComboDisplay.default,
    Example
};

export default module;
