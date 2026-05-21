import CopyValueButton from "../../../lib/components/input/copyValueButton/CopyValueButton";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ toastOnCopy: `Token copied to clipboard.` });

    return (
        <CopyValueButton
            value={`with-toast-token`}
            label={`Copy with toast`}
            toastOnCopy={`Token copied to clipboard.`}
        />
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.copyValueButton.withToast,
    Example
};

export default module;
