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
import { inlineEditExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    basic: `examples-basic`,
    heading: `examples-heading`,
    placeholder: `examples-placeholder`,
    fixedWidth: `examples-fixed-width`,
    disabled: `examples-disabled`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add mows-components-react`;

const USAGE_SNIPPET = `import { useState } from "react";
import { InlineEdit } from "mows-components-react";

const [name, setName] = useState("vm-control-01");

<InlineEdit value={name} onCommit={setName} ariaLabel="VM name" />`;

const COMPOSITION_SNIPPET = `// Basic — inline rename
<InlineEdit value={name} onCommit={setName} />

// As a heading
<InlineEdit
    as="h2"
    value={title}
    onCommit={setTitle}
    className="text-2xl font-semibold"
/>

// With placeholder when value is empty
<InlineEdit value={label} onCommit={setLabel} placeholder="Add a label…" />

// Read-only
<InlineEdit value={name} onCommit={() => {}} disabled />`;

const INLINE_EDIT_PROPS: PropRow[] = [
    {
        name: `value`,
        type: `string`,
        default: `(required)`,
        description: `Current value. The component is fully controlled.`
    },
    {
        name: `onCommit`,
        type: `(next: string) => void | Promise<void>`,
        default: `(required)`,
        description: `Fired when the user commits a non-empty, changed value (Enter or blur). Empty or unchanged values are silently discarded.`
    },
    {
        name: `placeholder`,
        type: `string`,
        default: `—`,
        description: `Shown in muted italic when value is empty (display mode only).`
    },
    {
        name: `disabled`,
        type: `boolean`,
        default: `false`,
        description: `Hide the edit affordances; the text still renders.`
    },
    {
        name: `as`,
        type: `"span" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6"`,
        default: `"span"`,
        description: `Override the rendered tag without losing inline editing.`
    },
    {
        name: `ariaLabel`,
        type: `string`,
        default: `—`,
        description: `aria-label for the underlying editable region.`
    },
    {
        name: `editAriaLabel`,
        type: `string`,
        default: `"Edit"`,
        description: `aria-label for the pencil button.`
    },
    {
        name: `saveAriaLabel`,
        type: `string`,
        default: `"Save"`,
        description: `aria-label for the check (save) button.`
    },
    {
        name: `cancelAriaLabel`,
        type: `string`,
        default: `"Cancel"`,
        description: `aria-label for the X (cancel) button.`
    },
    {
        name: `width`,
        type: `number | string`,
        default: `—`,
        description: `Lock the editor surface to a fixed CSS width (px when a number is passed). The contentEditable element no longer grows with the typed value — overflow is clipped and the caret scrolls within the fixed box, so the surrounding layout never reflows.`
    },
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes on the outer span.`
    },
    {
        name: `style`,
        type: `CSSProperties`,
        default: `—`,
        description: `Extra inline styles on the outer span.`
    }
];

const useDocStrings = () => {
    const ctx = React.useContext(MowsContext);
    if (!ctx) {
        throw new Error(`<InlineEditDocPage> must be rendered inside <MowsProvider>`);
    }
    return ctx.t.example.examples.inlineEdit;
};

type InlineEditStrings = ReturnType<typeof useDocStrings>;

const buildIndexItems = (t: InlineEditStrings): PageIndexItem[] => {
    const doc = t.doc;
    return [
        { id: ANCHOR.installation, label: doc.installation.title },
        {
            id: ANCHOR.examples,
            label: doc.examples.title,
            children: [
                { id: ANCHOR.basic, label: doc.examples.basic.title },
                { id: ANCHOR.heading, label: doc.examples.heading.title },
                { id: ANCHOR.placeholder, label: doc.examples.placeholder.title },
                { id: ANCHOR.fixedWidth, label: doc.examples.fixedWidth.title },
                { id: ANCHOR.disabled, label: doc.examples.disabled.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/input/inlineEdit/InlineEdit.test.tsx`;

const buildBehaviourEntries = (
    statements: InlineEditStrings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.rendersValue,
        testFile: TEST_FILE,
        testName: `renders the current value in display mode`,
        testLine: 16
    },
    {
        statement: statements.commitsOnEnter,
        testFile: TEST_FILE,
        testName: `commits on Enter with the trimmed value`,
        testLine: 24
    },
    {
        statement: statements.cancelsOnEscape,
        testFile: TEST_FILE,
        testName: `cancels on Escape without firing onCommit`,
        testLine: 42
    },
    {
        statement: statements.discardsUnchanged,
        testFile: TEST_FILE,
        testName: `discards empty or unchanged values`,
        testLine: 56
    },
    {
        statement: statements.hidesButtonsWhenDisabled,
        testFile: TEST_FILE,
        testName: `does not render edit / save / cancel buttons when disabled`,
        testLine: 80
    },
    {
        statement: statements.stableAffordanceWidth,
        testFile: TEST_FILE,
        testName: `keeps the affordance column at a fixed width across states`,
        testLine: 89
    },
    {
        statement: statements.fixedWidthDoesNotGrow,
        testFile: TEST_FILE,
        testName: `width prop locks the editor element to a fixed pixel width`,
        testLine: 105
    }
];

export const InlineEditDocPage = () => {
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
                        id={ANCHOR.basic}
                        title={doc.examples.basic.title}
                        description={doc.examples.basic.description}
                    >
                        <ExampleCard example={inlineEditExampleById(`basic`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.heading}
                        title={doc.examples.heading.title}
                        description={doc.examples.heading.description}
                    >
                        <ExampleCard example={inlineEditExampleById(`heading`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.placeholder}
                        title={doc.examples.placeholder.title}
                        description={doc.examples.placeholder.description}
                    >
                        <ExampleCard
                            example={inlineEditExampleById(`placeholder`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.fixedWidth}
                        title={doc.examples.fixedWidth.title}
                        description={doc.examples.fixedWidth.description}
                    >
                        <ExampleCard
                            example={inlineEditExampleById(`fixedWidth`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.disabled}
                        title={doc.examples.disabled.title}
                        description={doc.examples.disabled.description}
                    >
                        <ExampleCard example={inlineEditExampleById(`disabled`)} hideHeader />
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
                <PropTable heading={`<InlineEdit>`} rows={INLINE_EDIT_PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default InlineEditDocPage;
