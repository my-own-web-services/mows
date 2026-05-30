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
import { staggeredCheckboxesExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    examples: `examples`,
    default: `examples-default`,
    searchable: `examples-searchable`,
    selfOnly: `examples-self-only`,
    usage: `usage`,
    composition: `composition`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @my-own-web-services/react-components`;

const USAGE_SNIPPET = `import {
    StaggeredCheckboxes,
    type StaggeredCheckboxNode
} from "@my-own-web-services/react-components";

const TREE: StaggeredCheckboxNode[] = [
    {
        id: "frontend",
        label: "Frontend",
        children: [
            { id: "dashboard", label: "Dashboard" },
            { id: "settings",  label: "Settings"  }
        ]
    },
    { id: "api", label: "API" }
];

const [value, setValue] = useState<ReadonlySet<string>>(new Set());

<StaggeredCheckboxes
    nodes={TREE}
    value={value}
    onValueChange={setValue}
    searchable
    defaultExpanded
/>`;

const COMPOSITION_SNIPPET = `// Cascade modes:
//   propagateToLeaves (default) — clicking a parent toggles every enabled
//                                 leaf descendant. Indeterminate when only
//                                 some leaves are selected.
//   selfOnly                    — every node tracks its own id only.

<StaggeredCheckboxes
    nodes={permissions}
    value={grantedIds}
    onValueChange={setGrantedIds}
    cascade="selfOnly"
/>

// Search:
//   searchKeywords let a node match synonyms beyond its visible label.

const node = {
    id: "de",
    label: "Germany",
    searchKeywords: ["deutschland"]
};`;

const PROPS: PropRow[] = [
    { name: `nodes`, type: `readonly StaggeredCheckboxNode[]`, default: `—`, description: `Required. Tree of { id, label, children?, disabled?, searchKeywords?, searchLabel? } nodes.` },
    { name: `value`, type: `ReadonlySet<string>`, default: `—`, description: `Required. Set of currently-checked ids. Parents are computed from their leaf descendants.` },
    { name: `onValueChange`, type: `(next: ReadonlySet<string>) => void`, default: `—`, description: `Required. Fires with the next full selection set on every click.` },
    { name: `searchable`, type: `boolean`, default: `false`, description: `Show a <SearchInput> above the tree that filters by label, searchLabel, and searchKeywords.` },
    { name: `searchPlaceholder`, type: `string`, default: `—`, description: `Placeholder for the built-in search input.` },
    { name: `searchValue`, type: `string`, default: `—`, description: `Controlled search value. Pair with onSearchChange to manage state externally.` },
    { name: `onSearchChange`, type: `(value: string) => void`, default: `—`, description: `Called when the search input changes.` },
    { name: `defaultExpanded`, type: `boolean | ReadonlySet<string>`, default: `false`, description: `true to expand every branch on first render; a Set to expand specific ids.` },
    { name: `expanded`, type: `ReadonlySet<string>`, default: `—`, description: `Controlled expansion state.` },
    { name: `onExpandedChange`, type: `(next: ReadonlySet<string>) => void`, default: `—`, description: `Called when a branch is expanded or collapsed.` },
    { name: `cascade`, type: `"propagateToLeaves" | "selfOnly"`, default: `"propagateToLeaves"`, description: `Whether parent clicks toggle every leaf descendant or only the parent itself.` },
    { name: `emptyLabel`, type: `ReactNode`, default: `"No matches"`, description: `Body to render when the search query matches no nodes.` },
    { name: `disabled`, type: `boolean`, default: `false`, description: `Disable every checkbox in the tree.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext)
        throw new Error(`<StaggeredCheckboxesDocPage> must be rendered inside <MowsProvider>`);
    return mowsContext.t.example.examples.staggeredCheckboxes;
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
                { id: ANCHOR.searchable, label: doc.examples.searchable.title },
                { id: ANCHOR.selfOnly, label: doc.examples.selfOnly.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title }
    ];
};

const TEST_FILE = `lib/components/input/staggeredCheckboxes/StaggeredCheckboxes.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    { statement: statements.rendersCheckboxPerNode, testFile: TEST_FILE, testName: `renders one checkbox per node`, testLine: 58 },
    { statement: statements.togglingLeaf, testFile: TEST_FILE, testName: `toggling a leaf updates only that id`, testLine: 65 },
    { statement: statements.checkingParentPropagates, testFile: TEST_FILE, testName: `checking a parent propagates to every leaf descendant`, testLine: 82 },
    { statement: statements.uncheckingFullyCheckedParent, testFile: TEST_FILE, testName: `unchecking a fully-checked parent removes every leaf descendant`, testLine: 100 },
    { statement: statements.indeterminateWhenMixed, testFile: TEST_FILE, testName: `renders a parent in the indeterminate state when only some descendants are checked`, testLine: 116 },
    { statement: statements.checkedWhenAll, testFile: TEST_FILE, testName: `renders a parent as checked when every leaf descendant is checked`, testLine: 123 },
    { statement: statements.indeterminateEscalates, testFile: TEST_FILE, testName: `clicking an indeterminate parent escalates to fully checked`, testLine: 131 },
    { statement: statements.searchFilters, testFile: TEST_FILE, testName: `search filters the tree to matching nodes (case-insensitive)`, testLine: 149 },
    { statement: statements.emptyLabel, testFile: TEST_FILE, testName: `renders the empty label when search has no matches`, testLine: 163 },
    { statement: statements.branchesCollapseExpand, testFile: TEST_FILE, testName: `branches collapse and expand via the disclosure button`, testLine: 170 },
    { statement: statements.disabledExcluded, testFile: TEST_FILE, testName: `disabled nodes are not togglable and are excluded from cascading writes`, testLine: 191 },
    { statement: statements.cascadeSelfOnly, testFile: TEST_FILE, testName: `cascade="selfOnly" toggles just the clicked node`, testLine: 218 },
    { statement: statements.getNodeStateHelper, testFile: TEST_FILE, testName: `getNodeState helper returns indeterminate when descendants disagree`, testLine: 235 },
    { statement: statements.collectLeafIdsHelper, testFile: TEST_FILE, testName: `collectLeafIds returns every leaf descendant id`, testLine: 244 }
];

export const StaggeredCheckboxesDocPage = () => {
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
                            example={staggeredCheckboxesExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.searchable}
                        title={doc.examples.searchable.title}
                        description={doc.examples.searchable.description}
                    >
                        <ExampleCard
                            example={staggeredCheckboxesExampleById(`searchable`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.selfOnly}
                        title={doc.examples.selfOnly.title}
                        description={doc.examples.selfOnly.description}
                    >
                        <ExampleCard
                            example={staggeredCheckboxesExampleById(`selfOnly`)}
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
                <PropTable heading={`<StaggeredCheckboxes>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default StaggeredCheckboxesDocPage;
