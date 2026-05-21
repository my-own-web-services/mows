import CodeSnippet from "../../../lib/components/code/codeSnippet/CodeSnippet";
import type { CodeViewerLanguage } from "../../../lib/components/code/codeViewer/CodeViewer";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const SAMPLES: ReadonlyArray<{
    readonly language: CodeViewerLanguage;
    readonly label: string;
    readonly code: string;
}> = [
    {
        language: `typescript`,
        label: `typescript`,
        code: `interface Greeter { greet(name: string): string }`
    },
    {
        language: `json`,
        label: `json`,
        code: `{ "name": "mows", "deps": ["react", "vite"] }`
    },
    {
        language: `yaml`,
        label: `yaml`,
        code: `services:\n  api:\n    image: filez:latest\n    ports: [\"3000:3000\"]`
    },
    {
        language: `javascript`,
        label: `javascript`,
        code: `const sum = (a, b) => a + b;`
    },
    { language: `text`, label: `plain text`, code: `no syntax highlighting here` }
];

const Example = () => {
    useExampleState({ languages: SAMPLES.map((s) => s.label) });

    return (
        <div className={`flex flex-col gap-4`}>
            {SAMPLES.map((s) => (
                <div key={s.label} className={`flex flex-col gap-1`}>
                    <span className={`text-xs uppercase tracking-wide text-muted-foreground`}>
                        {s.label}
                    </span>
                    <CodeSnippet language={s.language} code={s.code} />
                </div>
            ))}
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.codeSnippet.languages,
    Example
};

export default module;
