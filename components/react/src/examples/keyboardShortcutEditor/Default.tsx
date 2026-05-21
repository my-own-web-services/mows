import KeyboardShortcutEditor from "../../../lib/components/actions/keyboardShortcutEditor/KeyboardShortcutEditor";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({});

    return <KeyboardShortcutEditor />;
};

const module: ExampleModule = {
    strings: (t) => t.examples.keyboardShortcutEditor.default,
    Example
};

export default module;
