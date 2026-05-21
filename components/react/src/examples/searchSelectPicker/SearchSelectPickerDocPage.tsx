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
import { searchSelectPickerExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    standalone: `examples-standalone`,
    popover: `examples-popover`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add mows-components-react`;

const USAGE_SNIPPET = `import { SearchSelectPicker } from "mows-components-react";

<SearchSelectPicker<Fruit>
    items={fruits}
    selected={value}
    onSelect={setValue}
    getId={(f) => f.id}
    matchesSearch={(f, q) => f.name.toLowerCase().includes(q.toLowerCase())}
    renderItemContent={(f) => <span>{f.name}</span>}
    placeholder="Search fruit…"
    emptyText="No matches"
    triggerTitle="Pick a fruit"
/>`;

const COMPOSITION_SNIPPET = `// standalone={true} drops the popover trigger and renders the searchable
// list inline. Pass renderTriggerContent to override what shows in the
// popover trigger (icons + label vs. just the renderItemContent default).

<SearchSelectPicker<Theme>
    items={themes}
    selected={current}
    onSelect={setTheme}
    standalone
    getId={(t) => t.id}
    matchesSearch={(t, q) => t.name.toLowerCase().includes(q.toLowerCase())}
    renderItemContent={(t) => <ThemeRow theme={t} />}
    renderTriggerContent={(t) => <>{t.name}</>}
    placeholder="Search theme…"
    emptyText="No themes match"
    triggerTitle="Pick a theme"
/>`;

const PROPS: PropRow[] = [
    { name: `items`, type: `readonly T[]`, default: `—`, description: `Required. The full list of selectable items.` },
    { name: `selected`, type: `T`, default: `—`, description: `Controlled selected item.` },
    { name: `onSelect`, type: `(item: T) => void`, default: `—`, description: `Required. Fires when the user picks an item from the list.` },
    { name: `getId`, type: `(item: T) => string`, default: `—`, description: `Required. Stable id for cmdk's key+value tracking.` },
    { name: `matchesSearch`, type: `(item: T, search: string) => boolean`, default: `—`, description: `Required. Decides whether the item matches the typed query.` },
    { name: `renderItemContent`, type: `(item: T) => ReactNode`, default: `—`, description: `Required. Renders the body of each row in the list.` },
    { name: `renderTriggerContent`, type: `(item: T) => ReactNode`, default: `renderItemContent`, description: `Override what's shown inside the popover trigger when an item is selected.` },
    { name: `standalone`, type: `boolean`, default: `false`, description: `Skip the popover trigger and render the search + list inline.` },
    { name: `placeholder`, type: `string`, default: `—`, description: `Search input placeholder.` },
    { name: `emptyText`, type: `string`, default: `—`, description: `Message shown when the search matches no items.` },
    { name: `triggerTitle`, type: `string`, default: `—`, description: `Required. Accessible label for the popover trigger.` },
    { name: `emptyTrigger`, type: `ReactNode`, default: `—`, description: `What to render in the popover trigger when no item is selected.` },
    { name: `defaultOpen`, type: `boolean`, default: `false`, description: `Open the popover on first mount.` },
    { name: `autoFocus`, type: `boolean`, default: `false`, description: `Auto-focus the search input on mount.` },
    { name: `onOpenChange`, type: `(open: boolean) => void`, default: `—`, description: `Fires when the popover open state changes.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) throw new Error(`<SearchSelectPickerDocPage> must be rendered inside <MowsProvider>`);
    return mowsContext.t.example.examples.searchSelectPicker;
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
                { id: ANCHOR.standalone, label: doc.examples.standalone.title },
                { id: ANCHOR.popover, label: doc.examples.popover.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/input/searchSelectPicker/SearchSelectPicker.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    { statement: statements.rendersInlineList, testFile: TEST_FILE, testName: `renders every item inline in standalone mode`, testLine: 44 },
    { statement: statements.filtersBySearch, testFile: TEST_FILE, testName: `filters items by search in standalone mode`, testLine: 51 },
    { statement: statements.emptyTextOnNoMatches, testFile: TEST_FILE, testName: `shows the empty-text fallback when search matches nothing`, testLine: 61 },
    { statement: statements.firesOnSelect, testFile: TEST_FILE, testName: `fires onSelect with the chosen item in standalone mode`, testLine: 68 },
    { statement: statements.fullyControllable, testFile: TEST_FILE, testName: `is fully controllable via selected + onSelect`, testLine: 76 },
    { statement: statements.popoverTriggerOpens, testFile: TEST_FILE, testName: `popover mode renders a trigger that opens the search list`, testLine: 106 }
];

export const SearchSelectPickerDocPage = () => {
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
                        id={ANCHOR.standalone}
                        title={doc.examples.standalone.title}
                        description={doc.examples.standalone.description}
                    >
                        <ExampleCard
                            example={searchSelectPickerExampleById(`standalone`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.popover}
                        title={doc.examples.popover.title}
                        description={doc.examples.popover.description}
                    >
                        <ExampleCard
                            example={searchSelectPickerExampleById(`popover`)}
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

            <DocSection id={ANCHOR.composition} title={doc.composition.title} description={doc.composition.body}>
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
                <BehaviourList entries={behaviourEntries} verifiedByLabel={doc.definedBehaviour.verifiedBy} />
            </DocSection>

            <DocSection id={ANCHOR.apiReference} title={doc.apiReference.title} description={doc.apiReference.intro}>
                <PropTable heading={`<SearchSelectPicker>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default SearchSelectPickerDocPage;
