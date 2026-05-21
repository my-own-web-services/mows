import { ScrollText, TerminalSquare } from "lucide-react";
import ConsoleManager from "../../../lib/components/console/consoleManager/ConsoleManager";
import LogView from "../../../lib/components/console/logView/LogView";
import Terminal from "../../../lib/components/console/terminal/Terminal";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const DEMO_LOG_LINES = [
    `[12:00:00] supervisor boot`,
    `[12:00:01] cluster ready`,
    `[12:00:02] watching agents…`,
    `[12:00:03] agent#1 connected`,
    `[12:00:04] agent#1 idle`
];

const Example = () => {
    useExampleState({});

    return (
        <div className={`h-[420px] w-full`}>
            <ConsoleManager
                defaultTypeId={`terminal`}
                types={[
                    {
                        id: `terminal`,
                        label: `Terminal`,
                        icon: TerminalSquare,
                        render: () => (
                            <Terminal
                                onReady={(handle) => {
                                    handle.write(`$ `);
                                }}
                                onData={(data) => {
                                    if (data === `\r`) return;
                                }}
                            />
                        )
                    },
                    {
                        id: `logs`,
                        label: `Logs`,
                        icon: ScrollText,
                        render: () => <LogView lines={DEMO_LOG_LINES} />
                    }
                ]}
                initialTabs={[{ typeId: `terminal` }, { typeId: `logs` }]}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.consoleManager.default,
    Example
};

export default module;
