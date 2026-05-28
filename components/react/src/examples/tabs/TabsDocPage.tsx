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
import { tabsExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    disabled: `examples-disabled`,
    controlled: `examples-controlled`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @my-own-web-services/react-components`;

const USAGE_SNIPPET = `import { Tabs, TabsList, TabsTrigger, TabsContent } from "@my-own-web-services/react-components";

<Tabs defaultValue="one">
    <TabsList>
        <TabsTrigger value="one">One</TabsTrigger>
        <TabsTrigger value="two">Two</TabsTrigger>
    </TabsList>
    <TabsContent value="one">Panel one</TabsContent>
    <TabsContent value="two">Panel two</TabsContent>
</Tabs>`;

const COMPOSITION_SNIPPET = `// <Tabs> is the Radix Tabs primitive in shadcn's new-york style. Each
// <TabsTrigger value> must match exactly one <TabsContent value>. Pass
// disabled on a trigger to make its panel unreachable; pass value +
// onValueChange to controll the active tab from outside.

const [tab, setTab] = useState("one");

<Tabs value={tab} onValueChange={setTab}>
    <TabsList>
        <TabsTrigger value="one">One</TabsTrigger>
        <TabsTrigger value="two" disabled>Two</TabsTrigger>
    </TabsList>
    <TabsContent value="one">Panel one</TabsContent>
    <TabsContent value="two">Panel two</TabsContent>
</Tabs>`;

const TABS_PROPS: PropRow[] = [
    {
        name: `defaultValue`,
        type: `string`,
        default: `—`,
        description: `Uncontrolled initial active value.`
    },
    {
        name: `value`,
        type: `string`,
        default: `—`,
        description: `Controlled active value. Pair with onValueChange.`
    },
    {
        name: `onValueChange`,
        type: `(value: string) => void`,
        default: `—`,
        description: `Called when the user activates a different tab.`
    },
    {
        name: `orientation`,
        type: `"horizontal" | "vertical"`,
        default: `"horizontal"`,
        description: `Visual + keyboard navigation orientation.`
    },
    {
        name: `dir`,
        type: `"ltr" | "rtl"`,
        default: `—`,
        description: `Override the inherited text direction.`
    },
    {
        name: `activationMode`,
        type: `"automatic" | "manual"`,
        default: `"automatic"`,
        description: `"automatic" activates on focus; "manual" requires Space / Enter.`
    }
];

const TRIGGER_PROPS: PropRow[] = [
    { name: `value`, type: `string`, default: `—`, description: `Required. Matches the value on the corresponding <TabsContent>.` },
    { name: `disabled`, type: `boolean`, default: `false`, description: `Disable this tab. The corresponding panel is unreachable via UI.` }
];

const CONTENT_PROPS: PropRow[] = [
    { name: `value`, type: `string`, default: `—`, description: `Required. Matches the value on the corresponding <TabsTrigger>.` },
    { name: `forceMount`, type: `boolean`, default: `false`, description: `Always render the panel in the DOM, even when inactive.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<TabsDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.tabs;
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
                { id: ANCHOR.disabled, label: doc.examples.disabled.title },
                { id: ANCHOR.controlled, label: doc.examples.controlled.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/ui/tabs.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.showsDefaultPanel,
        testFile: TEST_FILE,
        testName: `shows the default tab content`,
        testLine: 24
    },
    {
        statement: statements.switchesOnClick,
        testFile: TEST_FILE,
        testName: `switches content when a trigger is clicked`,
        testLine: 30
    },
    {
        statement: statements.dataStateActive,
        testFile: TEST_FILE,
        testName: `marks the active trigger via data-state`,
        testLine: 38
    },
    {
        statement: statements.disabledNoActivate,
        testFile: TEST_FILE,
        testName: `does not activate a disabled trigger`,
        testLine: 52
    },
    {
        statement: statements.controlledValue,
        testFile: TEST_FILE,
        testName: `honours a controlled value`,
        testLine: 61
    }
];

export const TabsDocPage = () => {
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
                            example={tabsExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.disabled}
                        title={doc.examples.disabled.title}
                        description={doc.examples.disabled.description}
                    >
                        <ExampleCard
                            example={tabsExampleById(`disabled`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.controlled}
                        title={doc.examples.controlled.title}
                        description={doc.examples.controlled.description}
                    >
                        <ExampleCard
                            example={tabsExampleById(`controlled`)}
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
                    <PropTable heading={`<Tabs>`} rows={TABS_PROPS} />
                    <PropTable heading={`<TabsTrigger>`} rows={TRIGGER_PROPS} />
                    <PropTable heading={`<TabsContent>`} rows={CONTENT_PROPS} />
                </div>
            </DocSection>
        </DocPage>
    );
};

export default TabsDocPage;
