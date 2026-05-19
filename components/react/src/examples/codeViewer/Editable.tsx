import { useState } from "react";
import CodeViewer from "../../../lib/components/code/codeViewer/CodeViewer";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [code, setCode] = useState(`{ "name": "demo", "value": 42 }`);
    useExampleState({ editable: true, characters: code.length });

    return (
        <CodeViewer
            code={code}
            language={`json`}
            editable
            onCodeChange={setCode}
        />
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.codeViewer.editable,
    Example
};

export default module;
