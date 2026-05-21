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
import { globalContextMenuExampleById } from "./index";

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

const PACKAGE_INSTALL = `add mows-components-react`;

const USAGE_SNIPPET = `import { GlobalContextMenu } from "mows-components-react";

<GlobalContextMenu />

{/* anywhere in the tree: */}
<div data-actionscope="myCard">
    {/* right-click inside this element opens the menu */}
</div>`;

const COMPOSITION_SNIPPET = `// 1. Register actions with at least one scope.
actionManager.registerAction(new Action({
    id: "card.greet",
    actionHandlers: new Map([
        ["MyCardGreet", {
            id: "MyCardGreet",
            scopes: ["myCard"],
            getState: () => ({ visibility: ActionVisibility.Shown }),
            executeAction: () => alert("hi")
        }]
    ])
}));

// 2. Mount the menu once globally.
<GlobalContextMenu />

// 3. Tag elements with data-actionscope="<scope>".
<div data-actionscope="myCard">right-click me</div>`;

const PROPS: PropRow[] = [
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes on the fixed-positioning wrapper. Rarely useful — the wrapper is a zero-size point at the cursor.`
    },
    {
        name: `style`,
        type: `CSSProperties`,
        default: `—`,
        description: `Inline style merged onto the positioning wrapper.`
    }
];

const useDocStrings = () => {
    const ctx = React.useContext(MowsContext);
    if (!ctx) {
        throw new Error(`<GlobalContextMenuDocPage> must be rendered inside <MowsProvider>`);
    }
    return ctx.t.example.examples.globalContextMenu;
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

const TEST_FILE = `lib/components/appShell/globalContextMenu/GlobalContextMenu.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.positionsAtCursor,
        testFile: TEST_FILE,
        testName: `positions the trigger wrapper exactly at the cursor coordinates`,
        testLine: 97
    },
    {
        statement: statements.sideOffsetZero,
        testFile: TEST_FILE,
        testName: `opens with sideOffset 0 so the menu starts at the cursor, not below it`,
        testLine: 121
    },
    {
        statement: statements.suppressesNativeOnlyWhenMatched,
        testFile: TEST_FILE,
        testName: `only suppresses the native context menu when there is a matching scoped action`,
        testLine: 146
    },
    {
        statement: statements.doesNotSuppressWhenScopeEmpty,
        testFile: TEST_FILE,
        testName: `does not suppress the native context menu when the scope has no actions`,
        testLine: 166
    },
    {
        statement: statements.clickItemDispatches,
        testFile: TEST_FILE,
        testName: `right-clicking a menu item dispatches the action and prevents the native context menu`,
        testLine: 185
    },
    {
        statement: statements.updatesOnSecondClick,
        testFile: TEST_FILE,
        testName: `updates the cursor position on a second right-click`,
        testLine: 246
    }
];

export const GlobalContextMenuDocPage = () => {
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
                            example={globalContextMenuExampleById(`default`)}
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
                <PropTable heading={`<GlobalContextMenu>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default GlobalContextMenuDocPage;
