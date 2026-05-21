import CodeViewer from "../../../lib/components/code/codeViewer/CodeViewer";
import ExpandableCode from "../../../lib/components/code/expandableCode/ExpandableCode";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ collapsedHeight: 280, fits: true });

    return (
        <div className={`w-full max-w-2xl`}>
            <ExpandableCode>
                <CodeViewer
                    code={`// Short content fits inside the default 280px collapsed height —\n// no Expand affordance is rendered.`}
                    language={`typescript`}
                    fitContent
                />
            </ExpandableCode>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.expandableCode.short,
    Example
};

export default module;
