import { useState } from "react";
import ModalHandler from "../../../lib/components/appShell/modalHandler/ModalHandler";
import {
    requestAlert,
    requestConfirm,
    requestPrompt
} from "../../../lib/components/appShell/modalHandler/imperativeRequests";
import { Button } from "../../../lib/components/ui/button";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [lastResult, setLastResult] = useState<string>(`(nothing yet)`);
    useExampleState({ lastResult });

    const onConfirm = async () => {
        const ok = await requestConfirm({
            title: `Reset scene?`,
            description: `This deletes working_dir/<id>/ and out/<id>/.`,
            confirmLabel: `Reset`,
            danger: true
        });
        setLastResult(`confirm → ${ok}`);
    };

    const onAlert = async () => {
        await requestAlert({
            title: `Build succeeded`,
            description: `Artifact uploaded to artifacts/build-123.tar.gz`,
            severity: `success`
        });
        setLastResult(`alert dismissed`);
    };

    const onPrompt = async () => {
        const value = await requestPrompt({
            title: `Rename scene`,
            description: `Enter a new name (min 3 characters).`,
            initial: `scene-1`,
            validate: (v) => (v.length < 3 ? `Too short` : null)
        });
        setLastResult(`prompt → ${value ?? `null`}`);
    };

    const onQueueTwo = async () => {
        const [a, b] = await Promise.all([
            requestConfirm({ title: `First question`, confirmLabel: `Yes` }),
            requestConfirm({ title: `Second question`, confirmLabel: `Yes` })
        ]);
        setLastResult(`queued → ${a} / ${b}`);
    };

    return (
        <div className={`flex flex-wrap gap-2`}>
            <Button onClick={onConfirm}>Confirm</Button>
            <Button onClick={onAlert}>Alert</Button>
            <Button onClick={onPrompt}>Prompt</Button>
            <Button variant={`outline`} onClick={onQueueTwo}>
                Queue 2 confirms
            </Button>
            {/* Mounted here to keep the example self-contained. In a real app
                <ModalHandler> is mounted once at the root inside <MowsProvider>. */}
            <ModalHandler />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.modalHandler.imperative,
    Example
};

export default module;
