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
import { expandableSectionExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    examples: `examples`,
    default: `examples-default`,
    stack: `examples-stack`,
    controlled: `examples-controlled`,
    disabled: `examples-disabled`,
    usage: `usage`,
    composition: `composition`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @my-own-web-services/react-components`;

const USAGE_SNIPPET = `import { ExpandableSection } from "@my-own-web-services/react-components";

<ExpandableSection
    header={<span className="font-medium">Opening hours</span>}
    expandLabel="Expand opening hours"
    collapseLabel="Collapse opening hours"
>
    <ul className="px-3 py-2 text-xs">
        <li>Monday — 09:00–18:00</li>
        <li>...</li>
    </ul>
</ExpandableSection>`;

const COMPOSITION_SNIPPET = `// Controlled disclosure:
const [open, setOpen] = useState(false);
<ExpandableSection
    header={<HeaderRow />}
    open={open}
    onOpenChange={setOpen}
>
    <Body />
</ExpandableSection>

// Disabled — no chevron, inert trigger:
<ExpandableSection
    header={<HeaderRow />}
    disabled
/>

// Custom chevron (or pass null to hide entirely):
<ExpandableSection
    header={<HeaderRow />}
    chevron={<ArrowDown className="h-3.5 w-3.5" />}
>
    <Body />
</ExpandableSection>`;

const PROPS: PropRow[] = [
    { name: `header`, type: `ReactNode`, default: `—`, description: `Required. Always-visible header rendered inside the trigger button.` },
    { name: `children`, type: `ReactNode`, default: `—`, description: `Body revealed when open. Omit to render a header-only card.` },
    { name: `open`, type: `boolean`, default: `—`, description: `Controlled open state. Pair with onOpenChange.` },
    { name: `defaultOpen`, type: `boolean`, default: `false`, description: `Initial open state when uncontrolled.` },
    { name: `onOpenChange`, type: `(open: boolean) => void`, default: `—`, description: `Fires whenever the disclosure toggles.` },
    { name: `disabled`, type: `boolean`, default: `false`, description: `Inert trigger; chevron hidden. Use when the section has nothing to reveal.` },
    { name: `expandLabel`, type: `string`, default: `—`, description: `aria-label applied to the trigger while collapsed.` },
    { name: `collapseLabel`, type: `string`, default: `—`, description: `aria-label applied to the trigger while expanded.` },
    { name: `chevron`, type: `ReactNode`, default: `<ChevronDown />`, description: `Replace the chevron glyph. Pass null to hide entirely.` },
    { name: `className`, type: `string`, default: `—`, description: `Extra class names on the outer Collapsible wrapper.` },
    { name: `triggerClassName`, type: `string`, default: `—`, description: `Extra class names on the trigger button row.` },
    { name: `contentClassName`, type: `string`, default: `—`, description: `Extra class names on the body wrapper that owns the top border.` },
    { name: `style`, type: `CSSProperties`, default: `—`, description: `Inline style on the outer wrapper.` },
    { name: `testId`, type: `string`, default: `—`, description: `data-testid forwarded to the outer wrapper; trigger and body inherit "-trigger" / "-body" suffixes.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext)
        throw new Error(`<ExpandableSectionDocPage> must be rendered inside <MowsProvider>`);
    return mowsContext.t.example.examples.expandableSection;
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
                { id: ANCHOR.stack, label: doc.examples.stack.title },
                { id: ANCHOR.controlled, label: doc.examples.controlled.title },
                { id: ANCHOR.disabled, label: doc.examples.disabled.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title }
    ];
};

const TEST_FILE = `lib/components/navigation/expandableSection/ExpandableSection.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    { statement: statements.collapsedByDefault, testFile: TEST_FILE, testName: `is collapsed by default — body is not rendered`, testLine: 13 },
    { statement: statements.opensOnClick, testFile: TEST_FILE, testName: `renders the body when opened via click`, testLine: 26 },
    { statement: statements.firesOnOpenChange, testFile: TEST_FILE, testName: `fires onOpenChange when the disclosure toggles`, testLine: 37 },
    { statement: statements.controllableOpen, testFile: TEST_FILE, testName: `is fully controllable via open + onOpenChange`, testLine: 55 },
    { statement: statements.defaultOpen, testFile: TEST_FILE, testName: `defaultOpen renders the body on first paint`, testLine: 79 },
    { statement: statements.ariaLabelPerState, testFile: TEST_FILE, testName: `disclosure button advertises the right aria-label per state`, testLine: 88 },
    { statement: statements.disabledDoesNotExpand, testFile: TEST_FILE, testName: `disabled sections do not expand on click and have no chevron`, testLine: 106 },
    { statement: statements.disabledHasNoAriaLabel, testFile: TEST_FILE, testName: `disabled sections have no aria-label so screen readers don't promise a disclosure`, testLine: 128 },
    { statement: statements.customChevron, testFile: TEST_FILE, testName: `renders a custom chevron when provided`, testLine: 142 },
    { statement: statements.hidesChevronWhenNull, testFile: TEST_FILE, testName: `hides the chevron when chevron={null}`, testLine: 155 },
    { statement: statements.omitsBodyWhenChildrenUndefined, testFile: TEST_FILE, testName: `omits the body wrapper entirely when children is undefined`, testLine: 168 },
    { statement: statements.forwardsClassNames, testFile: TEST_FILE, testName: `forwards extra class names to the wrapper, trigger, and body`, testLine: 176 }
];

export const ExpandableSectionDocPage = () => {
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
                            example={expandableSectionExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.stack}
                        title={doc.examples.stack.title}
                        description={doc.examples.stack.description}
                    >
                        <ExampleCard
                            example={expandableSectionExampleById(`stack`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.controlled}
                        title={doc.examples.controlled.title}
                        description={doc.examples.controlled.description}
                    >
                        <ExampleCard
                            example={expandableSectionExampleById(`controlled`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.disabled}
                        title={doc.examples.disabled.title}
                        description={doc.examples.disabled.description}
                    >
                        <ExampleCard
                            example={expandableSectionExampleById(`disabled`)}
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
                <PropTable heading={`<ExpandableSection>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default ExpandableSectionDocPage;
