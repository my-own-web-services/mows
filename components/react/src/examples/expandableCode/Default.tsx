import CodeViewer from "../../../lib/components/code/codeViewer/CodeViewer";
import ExpandableCode from "../../../lib/components/code/expandableCode/ExpandableCode";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const LONG_SNIPPET = Array.from({ length: 40 }, (_, i) =>
    `// line ${i + 1} of a long-ish snippet — clipped while collapsed`).join(`\n`);

const Example = () => {
    useExampleState({ collapsedHeight: 280 });

    return (
        <div className={`w-full max-w-2xl`}>
            <ExpandableCode>
                <CodeViewer code={LONG_SNIPPET} language={`typescript`} fitContent />
            </ExpandableCode>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.expandableCode.default,
    Example
};

export default module;
