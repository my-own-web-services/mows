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
import { cardExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    headerOnly: `examples-header-only`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @my-own-web-services/react-components`;

const USAGE_SNIPPET = `import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter
} from "@my-own-web-services/react-components";

<Card>
    <CardHeader>
        <CardTitle>Title</CardTitle>
        <CardDescription>A short supporting line.</CardDescription>
    </CardHeader>
    <CardContent>Body</CardContent>
    <CardFooter>Footer</CardFooter>
</Card>`;

const COMPOSITION_SNIPPET = `// Every Card slot is a plain forwardRef'd div with shadcn typography /
// padding classes. Header / Content / Footer are independent: omit any of
// them and the surrounding spacing still works.

<Card className="max-w-sm">
    <CardHeader>
        <CardTitle>Heads-up</CardTitle>
        <CardDescription>desc</CardDescription>
    </CardHeader>
</Card>`;

const PROPS: PropRow[] = [
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes merged onto the rendered div.`
    },
    {
        name: `...rest`,
        type: `HTMLAttributes<HTMLDivElement>`,
        default: `—`,
        description: `All other native div attributes (id, role, onClick, …) forward to the rendered element. Same applies to every Card subcomponent.`
    }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<CardDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.card;
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
                { id: ANCHOR.headerOnly, label: doc.examples.headerOnly.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/ui/card.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.shell,
        testFile: TEST_FILE,
        testName: `renders the card shell with rounded border + card background`,
        testLine: 14
    },
    {
        statement: statements.slotOrder,
        testFile: TEST_FILE,
        testName: `renders header / title / description / content / footer in order`,
        testLine: 23
    },
    {
        statement: statements.titleTypography,
        testFile: TEST_FILE,
        testName: `title carries the heading typography classes`,
        testLine: 39
    },
    {
        statement: statements.descriptionColour,
        testFile: TEST_FILE,
        testName: `description uses muted-foreground colour`,
        testLine: 46
    },
    {
        statement: statements.refForwarding,
        testFile: TEST_FILE,
        testName: `each subcomponent forwards a ref to its rendered div`,
        testLine: 52
    },
    {
        statement: statements.classNameMerge,
        testFile: TEST_FILE,
        testName: `each subcomponent merges a forwarded className with its base classes`,
        testLine: 64
    }
];

export const CardDocPage = () => {
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
                            example={cardExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.headerOnly}
                        title={doc.examples.headerOnly.title}
                        description={doc.examples.headerOnly.description}
                    >
                        <ExampleCard
                            example={cardExampleById(`headerOnly`)}
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
                <PropTable heading={`<Card> / <CardHeader> / <CardTitle> / <CardDescription> / <CardContent> / <CardFooter>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default CardDocPage;
