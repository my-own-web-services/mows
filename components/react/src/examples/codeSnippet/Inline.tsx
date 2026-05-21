import CodeSnippet from "../../../lib/components/code/codeSnippet/CodeSnippet";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ mode: `inline` });

    return (
        <div className={`flex flex-col gap-3 text-sm leading-relaxed`}>
            <p>
                {`Install the package with `}
                <CodeSnippet mode={`inline`} language={`text`} code={`pnpm add mows-components-react`} />
                , then import it in your entry file:
            </p>
            <p>
                {`Wrap your app: `}
                <CodeSnippet
                    mode={`inline`}
                    language={`tsx`}
                    code={`<MowsProvider storagePrefix="myapp">`}
                />
                {`. Inside class components read context via `}
                <CodeSnippet
                    mode={`inline`}
                    language={`typescript`}
                    code={`static contextType = MowsContext;`}
                />
                .
            </p>
            <p>
                {`Run a JSON payload through the API: `}
                <CodeSnippet
                    mode={`inline`}
                    language={`json`}
                    code={`{ "name": "mows", "version": 1 }`}
                />
                .
            </p>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.codeSnippet.inline,
    Example
};

export default module;
