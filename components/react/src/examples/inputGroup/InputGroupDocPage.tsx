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
import { inputGroupExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    trailingAddon: `examples-trailing-addon`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @my-own-web-services/react-components`;

const USAGE_SNIPPET = `import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput
} from "@my-own-web-services/react-components";

<InputGroup>
    <InputGroupAddon><Search /></InputGroupAddon>
    <InputGroupInput placeholder="Search…" />
</InputGroup>`;

const COMPOSITION_SNIPPET = `// Place the addon before the input for a leading icon, after the input
// for a trailing addon. Set align="inline-end" on a trailing addon so it
// sits at the end of the group. <InputGroupText> is a styled <span> for
// non-icon addons (currency code, unit, etc.).

<InputGroup>
    <InputGroupInput type="number" placeholder="Amount" />
    <InputGroupAddon align="inline-end">
        <InputGroupText>EUR</InputGroupText>
    </InputGroupAddon>
</InputGroup>

// Use <InputGroupButton> for actionable addons (clear, search submit, …).`;

const GROUP_PROPS: PropRow[] = [
    { name: `className`, type: `string`, default: `—`, description: `Extra classes on the group wrapper.` },
    { name: `...rest`, type: `HTMLAttributes<HTMLDivElement>`, default: `—`, description: `All other native div attributes forward to the wrapper.` }
];

const ADDON_PROPS: PropRow[] = [
    {
        name: `align`,
        type: `"inline-start" | "inline-end" | "block-start" | "block-end"`,
        default: `"inline-start"`,
        description: `Placement of the addon. inline-* sits beside the input; block-* stacks it above/below.`
    },
    { name: `className`, type: `string`, default: `—`, description: `Extra classes on the addon.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<InputGroupDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.inputGroup;
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
                { id: ANCHOR.trailingAddon, label: doc.examples.trailingAddon.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/ui/input-group.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.rendersGroup,
        testFile: TEST_FILE,
        testName: `renders a role="group" wrapper with the input + leading addon`,
        testLine: 13
    },
    {
        statement: statements.focusOnAddonClick,
        testFile: TEST_FILE,
        testName: `focuses the inner input when the addon is clicked`,
        testLine: 30
    },
    {
        statement: statements.alignInlineEnd,
        testFile: TEST_FILE,
        testName: `addon align="inline-end" places the addon last (data-align attribute)`,
        testLine: 46
    },
    {
        statement: statements.alignDefault,
        testFile: TEST_FILE,
        testName: `addon align defaults to inline-start when omitted`,
        testLine: 60
    },
    {
        statement: statements.forwardsAriaInvalid,
        testFile: TEST_FILE,
        testName: `forwards aria-invalid onto the inner input`,
        testLine: 74
    }
];

export const InputGroupDocPage = () => {
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
                                    <CodeViewer code={USAGE_SNIPPET} language={`tsx`} fitContent />
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
                            example={inputGroupExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.trailingAddon}
                        title={doc.examples.trailingAddon.title}
                        description={doc.examples.trailingAddon.description}
                    >
                        <ExampleCard
                            example={inputGroupExampleById(`trailingAddon`)}
                            hideHeader
                        />
                    </DocSubsection>
                </div>
            </DocSection>

            <DocSection id={ANCHOR.usage} title={doc.usage.title} description={doc.usage.body}>
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

            <DocSection id={ANCHOR.rtl} title={doc.rtl.title} description={doc.rtl.body} />

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
                    <PropTable heading={`<InputGroup>`} rows={GROUP_PROPS} />
                    <PropTable heading={`<InputGroupAddon>`} rows={ADDON_PROPS} />
                </div>
            </DocSection>
        </DocPage>
    );
};

export default InputGroupDocPage;
