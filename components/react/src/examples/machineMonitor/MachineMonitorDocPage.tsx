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
import { machineMonitorExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    readOnly: `examples-read-only`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add mows-components-react`;

const USAGE_SNIPPET = `import { MachineMonitor } from "mows-components-react";

<MachineMonitor
    url="wss://machine.example/vnc"
    autoConnect
    onConnect={() => console.log("connected")}
/>`;

const COMPOSITION_SNIPPET = `// MachineMonitor lazy-loads react-vnc / @novnc/novnc. Pass either a url or
// a pre-constructed WebSocket. Use readOnly for thumbnails / previews:
// it implies viewOnly AND lets scroll bubble + suppresses the dot cursor.

const ref = useRef<MachineMonitorHandle>(null);

<MachineMonitor
    ref={ref}
    url={url}
    autoConnect
    readOnly={isPreview}
    onConnect={() => setConnected(true)}
    onDisconnect={() => setConnected(false)}
/>

<Button onClick={() => ref.current?.sendCtrlAltDel()}>Send Ctrl-Alt-Del</Button>`;

const PROPS: PropRow[] = [
    {
        name: `url`,
        type: `string`,
        default: `—`,
        description: `Full ws:// or wss:// URL of the VNC stream. Required unless websocket is supplied.`
    },
    {
        name: `websocket`,
        type: `WebSocket`,
        default: `—`,
        description: `Pre-constructed WebSocket — used instead of url when provided.`
    },
    {
        name: `viewOnly`,
        type: `boolean`,
        default: `false`,
        description: `Disable keyboard / mouse input to the remote machine. The display continues to update.`
    },
    {
        name: `readOnly`,
        type: `boolean`,
        default: `false`,
        description: `Passive preview mode. Implies viewOnly AND prevents auto-focus, swallows wheel events, suppresses the dot cursor — for thumbnails / list previews.`
    },
    {
        name: `scaleViewport`,
        type: `boolean`,
        default: `true`,
        description: `Scale the framebuffer to fit the container.`
    },
    {
        name: `resizeSession`,
        type: `boolean`,
        default: `false`,
        description: `Renegotiate the remote desktop size when the container resizes.`
    },
    {
        name: `autoConnect`,
        type: `boolean`,
        default: `true`,
        description: `Connect immediately on mount.`
    },
    {
        name: `retryDuration`,
        type: `number`,
        default: `3000`,
        description: `Reconnect interval after a drop, in ms.`
    },
    {
        name: `password`,
        type: `string`,
        default: `—`,
        description: `Optional VNC password / credentials.`
    },
    {
        name: `loadingLabel`,
        type: `string`,
        default: `—`,
        description: `Placeholder shown while the react-vnc chunk loads or while the connection comes up.`
    },
    {
        name: `onConnect`,
        type: `() => void`,
        default: `—`,
        description: `Fires when the VNC session has connected.`
    },
    {
        name: `onDisconnect`,
        type: `() => void`,
        default: `—`,
        description: `Fires when the VNC session has disconnected.`
    },
    {
        name: `onSecurityFailure`,
        type: `(reason?: string) => void`,
        default: `—`,
        description: `Fires when authentication / security negotiation fails.`
    },
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes on the outer wrapper.`
    },
    {
        name: `style`,
        type: `CSSProperties`,
        default: `—`,
        description: `Inline style on the outer wrapper.`
    }
];

const HANDLE_PROPS: PropRow[] = [
    { name: `connect`, type: `() => void`, default: `—`, description: `Open the session if it is not already connected.` },
    { name: `disconnect`, type: `() => void`, default: `—`, description: `Close the session.` },
    { name: `sendCtrlAltDel`, type: `() => void`, default: `—`, description: `Send the Ctrl-Alt-Del key combo to the remote machine.` },
    { name: `focus`, type: `() => void`, default: `—`, description: `Focus the canvas so it receives keyboard input.` },
    { name: `blur`, type: `() => void`, default: `—`, description: `Blur the canvas to release keyboard capture.` },
    { name: `machineShutdown`, type: `() => void`, default: `—`, description: `Send an ACPI shutdown signal (where supported by the VNC server).` },
    { name: `machineReboot`, type: `() => void`, default: `—`, description: `Send an ACPI reboot signal.` },
    { name: `machineReset`, type: `() => void`, default: `—`, description: `Send a hard-reset signal.` },
    { name: `clipboardPaste`, type: `(text: string) => void`, default: `—`, description: `Inject clipboard contents into the remote session.` },
    { name: `connected`, type: `boolean`, default: `—`, description: `Read-only: true while the VNC session is connected.` }
];

const useDocStrings = () => {
    const ctx = React.useContext(MowsContext);
    if (!ctx) {
        throw new Error(`<MachineMonitorDocPage> must be rendered inside <MowsProvider>`);
    }
    return ctx.t.example.examples.machineMonitor;
};

type Strings = ReturnType<typeof useDocStrings>;

const buildIndexItems = (t: Strings): PageIndexItem[] => {
    const doc = t.doc;
    return [
        { id: ANCHOR.installation, label: doc.installation.title },
        {
            id: ANCHOR.examples,
            label: doc.examples.title,
            children: [
                { id: ANCHOR.default, label: doc.examples.default.title },
                { id: ANCHOR.readOnly, label: doc.examples.readOnly.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/console/machineMonitor/MachineMonitor.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.remountsOnUrl,
        testFile: TEST_FILE,
        testName: `remounts the inner VncScreen when the url prop changes`,
        testLine: 45
    },
    {
        statement: statements.readOnlyForcesViewOnly,
        testFile: TEST_FILE,
        testName: `readOnly forces viewOnly + disables focusOnClick / dot cursor`,
        testLine: 71
    },
    {
        statement: statements.readOnlyPointerEventsNone,
        testFile: TEST_FILE,
        testName: `readOnly wraps the canvas in a pointer-events:none element`,
        testLine: 80
    },
    {
        statement: statements.noPointerEventsWithoutReadOnly,
        testFile: TEST_FILE,
        testName: `does not set pointer-events:none when readOnly is omitted`,
        testLine: 99
    },
    {
        statement: statements.preservesExplicitViewOnly,
        testFile: TEST_FILE,
        testName: `explicit viewOnly is preserved when readOnly is not set`,
        testLine: 111
    }
];

export const MachineMonitorDocPage = () => {
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
                            example={machineMonitorExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.readOnly}
                        title={doc.examples.readOnly.title}
                        description={doc.examples.readOnly.description}
                    >
                        <ExampleCard
                            example={machineMonitorExampleById(`readOnly`)}
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
                    <PropTable heading={`<MachineMonitor>`} rows={PROPS} />
                    <PropTable heading={`MachineMonitorHandle`} rows={HANDLE_PROPS} />
                </div>
            </DocSection>
        </DocPage>
    );
};

export default MachineMonitorDocPage;
