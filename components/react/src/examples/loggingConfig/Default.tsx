import LoggingConfig from "../../../lib/components/settings/loggingConfig/LoggingConfig";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({});

    return (
        <div className={`max-w-2xl`}>
            <LoggingConfig />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.loggingConfig.default,
    Example
};

export default module;
