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
import { buttonExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    variants: `examples-variants`,
    sizes: `examples-sizes`,
    asChild: `examples-as-child`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add mows-components-react`;

const USAGE_SNIPPET = `import { Button } from "mows-components-react";

<Button onClick={save}>Save</Button>`;

const COMPOSITION_SNIPPET = `// asChild forwards the button styling onto its single child element using
// Radix Slot. The common case is rendering a Link / <a> with button styling
// without nesting a button inside an anchor.

<Button asChild>
    <a href="/settings">Settings</a>
</Button>`;

const PROPS: PropRow[] = [
    {
        name: `variant`,
        type: `"default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "iconStandalone"`,
        default: `"default"`,
        description: `Visual treatment.`
    },
    {
        name: `size`,
        type: `"default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg" | "icon-xs"`,
        default: `"default"`,
        description: `Size + padding. The icon* sizes produce a square button sized to fit a single icon.`
    },
    {
        name: `asChild`,
        type: `boolean`,
        default: `false`,
        description: `Render the styling onto the single child element via Radix Slot instead of a native <button>.`
    },
    {
        name: `disabled`,
        type: `boolean`,
        default: `false`,
        description: `Disable the button. Forwarded onto the native element.`
    },
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes merged after the variant + size classes.`
    },
    {
        name: `...rest`,
        type: `ButtonHTMLAttributes<HTMLButtonElement>`,
        default: `—`,
        description: `All other native button attributes forward (onClick, type, name, …).`
    }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<ButtonDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.button;
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
                { id: ANCHOR.variants, label: doc.examples.variants.title },
                { id: ANCHOR.sizes, label: doc.examples.sizes.title },
                { id: ANCHOR.asChild, label: doc.examples.asChild.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/ui/button.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.rendersNativeButton,
        testFile: TEST_FILE,
        testName: `renders a native button element by default`,
        testLine: 8
    },
    {
        statement: statements.defaultVariantAndSize,
        testFile: TEST_FILE,
        testName: `applies the default variant + size when none is provided`,
        testLine: 14
    },
    {
        statement: statements.appliesVariants,
        testFile: TEST_FILE,
        testName: `applies %s variant classes`,
        testLine: 21
    },
    {
        statement: statements.appliesSizes,
        testFile: TEST_FILE,
        testName: `applies %s size classes`,
        testLine: 34
    },
    {
        statement: statements.firesOnClick,
        testFile: TEST_FILE,
        testName: `fires onClick when clicked`,
        testLine: 47
    },
    {
        statement: statements.noClickWhenDisabled,
        testFile: TEST_FILE,
        testName: `does not fire onClick when disabled`,
        testLine: 55
    },
    {
        statement: statements.asChildRendersChild,
        testFile: TEST_FILE,
        testName: `asChild renders the child element instead of a native button`,
        testLine: 67
    }
];

export const ButtonDocPage = () => {
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
                            example={buttonExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.variants}
                        title={doc.examples.variants.title}
                        description={doc.examples.variants.description}
                    >
                        <ExampleCard
                            example={buttonExampleById(`variants`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.sizes}
                        title={doc.examples.sizes.title}
                        description={doc.examples.sizes.description}
                    >
                        <ExampleCard
                            example={buttonExampleById(`sizes`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.asChild}
                        title={doc.examples.asChild.title}
                        description={doc.examples.asChild.description}
                    >
                        <ExampleCard
                            example={buttonExampleById(`asChild`)}
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
                <PropTable heading={`<Button>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default ButtonDocPage;
