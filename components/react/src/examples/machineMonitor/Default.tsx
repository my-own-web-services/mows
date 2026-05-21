import { useState } from "react";
import MachineMonitor from "../../../lib/components/console/machineMonitor/MachineMonitor";
import { Button } from "../../../lib/components/ui/button";
import { Input } from "../../../lib/components/ui/input";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [urlDraft, setUrlDraft] = useState(``);
    const [activeUrl, setActiveUrl] = useState<string | undefined>(undefined);
    useExampleState({ activeUrl });

    return (
        <div className={`flex flex-col gap-3`}>
            <div className={`flex flex-wrap items-center gap-2`}>
                <Input
                    type={`url`}
                    value={urlDraft}
                    onChange={(e) => setUrlDraft(e.target.value)}
                    placeholder={`wss://machine.example/vnc`}
                    className={`max-w-sm`}
                />
                {activeUrl ? (
                    <Button
                        size={`sm`}
                        variant={`outline`}
                        onClick={() => setActiveUrl(undefined)}
                    >
                        Disconnect
                    </Button>
                ) : (
                    <Button
                        size={`sm`}
                        disabled={!urlDraft}
                        onClick={() => setActiveUrl(urlDraft)}
                    >
                        Connect
                    </Button>
                )}
            </div>
            <div className={`aspect-[4/3] w-full max-w-2xl`}>
                <MachineMonitor
                    url={activeUrl}
                    autoConnect={Boolean(activeUrl)}
                    loadingLabel={`Loading VNC…`}
                />
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.machineMonitor.default,
    Example
};

export default module;
