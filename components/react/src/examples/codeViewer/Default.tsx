import CodeViewer from "../../../lib/components/code/codeViewer/CodeViewer";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const SAMPLE = `const greet = (name: string) => {
    console.log(\`Hello, \${name}!\`);
};

greet("world");
`;

const Example = () => {
    useExampleState({ language: `typescript`, lines: SAMPLE.split(`\n`).length });

    return <CodeViewer code={SAMPLE} language={`typescript`} />;
};

const module: ExampleModule = {
    strings: (t) => t.examples.codeViewer.default,
    Example
};

export default module;
