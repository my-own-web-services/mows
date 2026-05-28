import * as React from "react";
import CodeViewer from "../../../lib/components/code/codeViewer/CodeViewer";
import ExpandableCode from "../../../lib/components/code/expandableCode/ExpandableCode";
import { type PageIndexItem } from "../../../lib/components/navigation/pageIndex/PageIndex";
import { MowsContext } from "../../../lib/lib/mowsContext/MowsContext";
import { CommandBlock } from "../harness/docPage/CommandBlock";
import { ExampleCard } from "../harness/ExampleCard";
import {
    BehaviourList,
    type BehaviourEntry,
    DocPage,
    DocSection,
    DocSubsection,
    InstallationTabs,
    ManualStep,
    ManualSteps,
    PropTable,
    type PropRow
} from "../harness/docPage";
import { terminalExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @my-own-web-services/react-components`;

const USAGE_SNIPPET = `import { Terminal, type TerminalHandle } from "@my-own-web-services/react-components";

const ref = useRef<TerminalHandle>(null);

<Terminal
    ref={ref}
    onData={(data) => console.log("user typed:", data)}
    onReady={(handle) => handle.write("Welcome\\r\\n$ ")}
/>`;

const COMPOSITION_SNIPPET = `// Terminal is a lazy-loaded wrapper around xterm.js. Its imperative handle
// exposes write / writeln / clear / focus / fit so the consumer drives the
// surface — there's no "input value" prop.

const ref = useRef<TerminalHandle>(null);

useEffect(() => {
    ref.current?.writeln("starting...");
    const id = setInterval(() => ref.current?.writeln(new Date().toISOString()), 1000);
    return () => clearInterval(id);
}, []);

<Terminal ref={ref} />`;

const TERMINAL_PROPS: PropRow[] = [
    {
        name: `onData`,
        type: `(data: string) => void`,
        default: `—`,
        description: `Fires for every keypress / paste the user produces inside the terminal.`
    },
    {
        name: `onResize`,
        type: `(cols: number, rows: number) => void`,
        default: `—`,
        description: `Fires whenever xterm recomputes its grid (window resize, font change).`
    },
    {
        name: `onReady`,
        type: `(handle: TerminalHandle) => void`,
        default: `—`,
        description: `Fires once the xterm chunk has loaded and the terminal is mounted. Use this to write a banner or focus without waiting on a separate effect.`
    },
    {
        name: `fontSize`,
        type: `number`,
        default: `13`,
        description: `Default font size in px.`
    },
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes on the outer wrapper (also applied to the Suspense fallback).`
    },
    {
        name: `style`,
        type: `CSSProperties`,
        default: `—`,
        description: `Inline style on the outer wrapper.`
    }
];

const HANDLE_PROPS: PropRow[] = [
    { name: `write`, type: `(data: string | Uint8Array) => void`, default: `—`, description: `Write raw bytes / a string into the terminal.` },
    { name: `writeln`, type: `(data: string | Uint8Array) => void`, default: `—`, description: `Write the string + a trailing CRLF.` },
    { name: `clear`, type: `() => void`, default: `—`, description: `Clear the visible buffer.` },
    { name: `focus`, type: `() => void`, default: `—`, description: `Focus the terminal so it receives keyboard input.` },
    { name: `fit`, type: `() => void`, default: `—`, description: `Force a refit to the current container size.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<TerminalDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.terminal;
};

type Strings = ReturnType<typeof useDocStrings>;

const buildIndexItems = (t: Strings): PageIndexItem[] => {
    const doc = t.doc;
    return [
        { id: ANCHOR.installation, label: doc.installation.title },
        {
            id: ANCHOR.examples,
            label: doc.examples.title,
            children: [{ id: ANCHOR.default, label: doc.examples.default.title }]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/console/terminal/Terminal.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.suspendsAndMounts,
        testFile: TEST_FILE,
        testName: `shows the suspense fallback before the xterm chunk resolves, then mounts it`,
        testLine: 39
    },
    {
        statement: statements.forwardsHandle,
        testFile: TEST_FILE,
        testName: `forwards the imperative handle (write/clear/focus/fit) through the lazy boundary`,
        testLine: 49
    },
    {
        statement: statements.firesOnData,
        testFile: TEST_FILE,
        testName: `invokes onData when xterm reports user input`,
        testLine: 67
    }
];

export const TerminalDocPage = () => {
    const t = useDocStrings();
    const doc = t.doc;
    const indexItems = React.useMemo(() => buildIndexItems(t), [t]);
    const behaviourEntries = React.useMemo(
        () => buildBehaviourEntries(doc.definedBehaviour.statements),
        [doc.definedBehaviour.statements]
    );

    return (
        <DocPage indexItems={indexItems}>
            <DocSection id={ANCHOR.installation} title={doc.installation.title}>
                <InstallationTabs
                    commandTabLabel={doc.installation.commandTab}
                    manualTabLabel={doc.installation.manualTab}
                    command={PACKAGE_INSTALL}
                    manual={
                        <ManualSteps>
                            <ManualStep stepNumber={1}>
                                <p className={`text-sm`}>{doc.installation.manualStep1}</p>
                                <CommandBlock command={PACKAGE_INSTALL} />
                            </ManualStep>
                            <ManualStep stepNumber={2}>
                                <p className={`text-sm`}>{doc.installation.manualStep2}</p>
                                <ExpandableCode>
                                    <CodeViewer
                                        code={USAGE_SNIPPET}
                                        language={`tsx`}
                                        fitContent
                                    />
                                </ExpandableCode>
                            </ManualStep>
                            <ManualStep stepNumber={3} isLast>
                                <p className={`text-sm`}>{doc.installation.manualStep3}</p>
                            </ManualStep>
                        </ManualSteps>
                    }
                />
            </DocSection>

            <DocSection id={ANCHOR.examples} title={doc.examples.title}>
                <div className={`flex flex-col gap-10`}>
                    <DocSubsection
                        id={ANCHOR.default}
                        title={doc.examples.default.title}
                        description={doc.examples.default.description}
                    >
                        <ExampleCard
                            example={terminalExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                </div>
            </DocSection>

            <DocSection
                id={ANCHOR.usage}
                title={doc.usage.title}
                description={doc.usage.body}
            >
                <ExpandableCode>
                    <CodeViewer code={USAGE_SNIPPET} language={`tsx`} fitContent />
                </ExpandableCode>
            </DocSection>

            <DocSection
                id={ANCHOR.composition}
                title={doc.composition.title}
                description={doc.composition.body}
            >
                <ExpandableCode>
                    <CodeViewer code={COMPOSITION_SNIPPET} language={`tsx`} fitContent />
                </ExpandableCode>
            </DocSection>

            <DocSection
                id={ANCHOR.rtl}
                title={doc.rtl.title}
                description={doc.rtl.body}
            />

            <DocSection
                id={ANCHOR.definedBehaviour}
                title={doc.definedBehaviour.title}
                description={doc.definedBehaviour.intro}
            >
                <BehaviourList
                    entries={behaviourEntries}
                    verifiedByLabel={doc.definedBehaviour.verifiedBy}
                />
            </DocSection>

            <DocSection
                id={ANCHOR.apiReference}
                title={doc.apiReference.title}
                description={doc.apiReference.intro}
            >
                <div className={`flex flex-col gap-8`}>
                    <PropTable heading={`<Terminal>`} rows={TERMINAL_PROPS} />
                    <PropTable heading={`TerminalHandle`} rows={HANDLE_PROPS} />
                </div>
            </DocSection>
        </DocPage>
    );
};

export default TerminalDocPage;
