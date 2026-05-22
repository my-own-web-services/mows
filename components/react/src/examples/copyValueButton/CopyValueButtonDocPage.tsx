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
import { copyValueButtonExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    label: `examples-label`,
    iconOnly: `examples-icon-only`,
    withToast: `examples-with-toast`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @mows/react-components`;

const USAGE_SNIPPET = `import { CopyValueButton } from "@mows/react-components";

<CopyValueButton value="my-token" label="Copy token" />`;

const COMPOSITION_SNIPPET = `// Set toastOnCopy to surface a Sonner toast on a successful copy.
// Pass a string to override the default "Copied" message.

<CopyValueButton
    value="my-token"
    label="Copy token"
    toastOnCopy="Token copied to clipboard."
/>`;

const PROPS: PropRow[] = [
    {
        name: `value`,
        type: `string`,
        default: `—`,
        description: `Required. The string written to navigator.clipboard on click.`
    },
    {
        name: `label`,
        type: `string`,
        default: `—`,
        description: `Visible label next to the icon. Omit for an icon-only button.`
    },
    {
        name: `title`,
        type: `string`,
        default: `—`,
        description: `Native tooltip text shown on hover when the button is not in its "Copied!" state.`
    },
    {
        name: `toastOnCopy`,
        type: `boolean | string`,
        default: `—`,
        description: `If set, fires a Sonner toast on copy. Pass true for the default message ("Copied") or a string to use as the message.`
    },
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes on the wrapper.`
    },
    {
        name: `style`,
        type: `CSSProperties`,
        default: `—`,
        description: `Inline style on the wrapper.`
    }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<CopyValueButtonDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.copyValueButton;
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
                { id: ANCHOR.label, label: doc.examples.label.title },
                { id: ANCHOR.iconOnly, label: doc.examples.iconOnly.title },
                { id: ANCHOR.withToast, label: doc.examples.withToast.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/input/copyValueButton/CopyValueButton.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.rendersLabelWhenProvided,
        testFile: TEST_FILE,
        testName: `renders the label when one is provided`,
        testLine: 29
    },
    {
        statement: statements.omitsLabelWhenAbsent,
        testFile: TEST_FILE,
        testName: `omits the label when none is provided`,
        testLine: 34
    },
    {
        statement: statements.writesClipboardOnClick,
        testFile: TEST_FILE,
        testName: `writes the value to the clipboard on click`,
        testLine: 39
    },
    {
        statement: statements.showsCopiedTitleTransient,
        testFile: TEST_FILE,
        testName: `shows the copied title for ~1.5s after a copy`,
        testLine: 46
    },
    {
        statement: statements.firesToastWhenTrue,
        testFile: TEST_FILE,
        testName: `fires a toast when toastOnCopy is true`,
        testLine: 62
    },
    {
        statement: statements.usesProvidedToastMessage,
        testFile: TEST_FILE,
        testName: `uses the provided string as the toast message`,
        testLine: 71
    },
    {
        statement: statements.noToastWhenOmitted,
        testFile: TEST_FILE,
        testName: `does not fire a toast when toastOnCopy is omitted`,
        testLine: 84
    }
];

export const CopyValueButtonDocPage = () => {
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
                        id={ANCHOR.label}
                        title={doc.examples.label.title}
                        description={doc.examples.label.description}
                    >
                        <ExampleCard
                            example={copyValueButtonExampleById(`label`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.iconOnly}
                        title={doc.examples.iconOnly.title}
                        description={doc.examples.iconOnly.description}
                    >
                        <ExampleCard
                            example={copyValueButtonExampleById(`iconOnly`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.withToast}
                        title={doc.examples.withToast.title}
                        description={doc.examples.withToast.description}
                    >
                        <ExampleCard
                            example={copyValueButtonExampleById(`withToast`)}
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
                <PropTable heading={`<CopyValueButton>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default CopyValueButtonDocPage;
