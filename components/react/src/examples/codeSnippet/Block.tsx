import CodeSnippet from "../../../lib/components/code/codeSnippet/CodeSnippet";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const SAMPLE = `const greet = (name: string) => {
    console.log(\`Hello, \${name}!\`);
};

greet("world");`;

const Example = () => {
    useExampleState({ mode: `block`, language: `typescript`, lines: SAMPLE.split(`\n`).length });

    return <CodeSnippet language={`typescript`} code={SAMPLE} />;
};

const module: ExampleModule = {
    strings: (t) => t.examples.codeSnippet.block,
    Example
};

export default module;
