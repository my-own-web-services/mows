import CodeViewer from "../../../lib/components/code/codeViewer/CodeViewer";
import ExpandableCode from "../../../lib/components/code/expandableCode/ExpandableCode";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const SAMPLE = `// fitContent makes the editor grow to its content height — no
// internal scrollbar. Pair it with <ExpandableCode> to collapse long
// snippets behind an Expand button while keeping the natural height
// for short ones.

const sum = (xs: number[]): number =>
    xs.reduce((acc, x) => acc + x, 0);

const product = (xs: number[]): number =>
    xs.reduce((acc, x) => acc * x, 1);
`;

const Example = () => {
    useExampleState({ fitContent: true });

    return (
        <ExpandableCode>
            <CodeViewer code={SAMPLE} language={`typescript`} fitContent />
        </ExpandableCode>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.codeViewer.fitContent,
    Example
};

export default module;
