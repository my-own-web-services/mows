import { useState } from "react";
import KeyComboRecorder from "../../../lib/components/actions/keyComboRecorder/KeyComboRecorder";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [last, setLast] = useState<string | null>(null);
    useExampleState({ last });

    return (
        <div className={`max-w-2xl`}>
            <KeyComboRecorder onCombo={(c) => setLast(c)} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.keyComboRecorder.default,
    Example
};

export default module;
