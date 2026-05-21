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
import { searchInputExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    hideIcon: `examples-hide-icon`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add mows-components-react`;

const USAGE_SNIPPET = `import { SearchInput } from "mows-components-react";

const [value, setValue] = useState("");

<SearchInput
    value={value}
    onValueChange={setValue}
    placeholder="Search…"
/>`;

const COMPOSITION_SNIPPET = `// SearchInput wraps InputGroup + InputGroupAddon (search icon) + a
// hover/focus-revealed clear button. It strips the browser-native
// type=search clear control and emits its own.

<SearchInput value={query} onValueChange={setQuery} hideIcon />
<SearchInput value={query} onValueChange={setQuery} hideClearButton />`;

const PROPS: PropRow[] = [
    { name: `value`, type: `string`, default: `—`, description: `Required. Controlled value.` },
    { name: `onValueChange`, type: `(value: string) => void`, default: `—`, description: `Required. Fires on every change; also receives "" when the clear button is clicked.` },
    { name: `placeholder`, type: `string`, default: `—`, description: `Placeholder text shown when value is empty. Also used as the aria-label fallback.` },
    { name: `aria-label`, type: `string`, default: `—`, description: `Accessible label for the input. Falls back to placeholder when omitted.` },
    { name: `clearAriaLabel`, type: `string`, default: `"Clear search"`, description: `Accessible label for the clear button.` },
    { name: `hideIcon`, type: `boolean`, default: `false`, description: `Hide the leading search icon.` },
    { name: `hideClearButton`, type: `boolean`, default: `false`, description: `Hide the clear button even when the field is non-empty.` },
    { name: `autoFocus`, type: `boolean`, default: `false`, description: `Autofocus the input on mount.` },
    { name: `disabled`, type: `boolean`, default: `false`, description: `Disable both the input and the clear button.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) throw new Error(`<SearchInputDocPage> must be rendered inside <MowsProvider>`);
    return mowsContext.t.example.examples.searchInput;
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
                { id: ANCHOR.hideIcon, label: doc.examples.hideIcon.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/input/searchInput/SearchInput.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    { statement: statements.typeSearch, testFile: TEST_FILE, testName: `renders a type="search" input`, testLine: 17 },
    { statement: statements.leadingIcon, testFile: TEST_FILE, testName: `renders the leading search icon by default`, testLine: 24 },
    { statement: statements.hideIcon, testFile: TEST_FILE, testName: `hideIcon removes the leading addon`, testLine: 31 },
    { statement: statements.firesOnValueChange, testFile: TEST_FILE, testName: `fires onValueChange when the user types`, testLine: 37 },
    { statement: statements.showsClearWhenNonEmpty, testFile: TEST_FILE, testName: `shows the clear button once the value is non-empty`, testLine: 45 },
    { statement: statements.clearResetsValue, testFile: TEST_FILE, testName: `clicking the clear button resets the value to ""`, testLine: 50 },
    { statement: statements.hideClearButton, testFile: TEST_FILE, testName: `hideClearButton suppresses the clear button even when non-empty`, testLine: 65 },
    { statement: statements.disabledForwards, testFile: TEST_FILE, testName: `disabled forwards onto the input and clear button`, testLine: 77 }
];

export const SearchInputDocPage = () => {
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
                        <ExampleCard example={searchInputExampleById(`default`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.hideIcon}
                        title={doc.examples.hideIcon.title}
                        description={doc.examples.hideIcon.description}
                    >
                        <ExampleCard example={searchInputExampleById(`hideIcon`)} hideHeader />
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
                <PropTable heading={`<SearchInput>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default SearchInputDocPage;
