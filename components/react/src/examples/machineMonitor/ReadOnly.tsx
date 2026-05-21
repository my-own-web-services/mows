import MachineMonitor from "../../../lib/components/console/machineMonitor/MachineMonitor";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ readOnly: true });

    return (
        <div className={`aspect-[4/3] w-full max-w-2xl`}>
            <MachineMonitor
                readOnly
                url={undefined}
                loadingLabel={`Read-only preview — no remote connection in this example.`}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.machineMonitor.readOnly,
    Example
};

export default module;
