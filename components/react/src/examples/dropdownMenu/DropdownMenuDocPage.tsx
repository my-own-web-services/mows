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
import { dropdownMenuExampleById } from "./index";

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

const PACKAGE_INSTALL = `add @mows/react-components`;

const USAGE_SNIPPET = `import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuItem
} from "@mows/react-components";

<DropdownMenu>
    <DropdownMenuTrigger asChild>
        <Button variant="outline">Open</Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>Settings</DropdownMenuItem>
    </DropdownMenuContent>
</DropdownMenu>`;

const COMPOSITION_SNIPPET = `// DropdownMenu wraps Radix Dropdown. Use Label for group headings, Separator
// for visual grouping, and disabled on items that should not respond to
// clicks. Selecting an item closes the menu by default; call
// event.preventDefault() inside onSelect to keep it open (e.g. when toggling
// a checkbox-style item).

<DropdownMenuItem
    onSelect={(e) => {
        e.preventDefault();
        toggle();
    }}
>
    Toggle (stays open)
</DropdownMenuItem>`;

const ROOT_PROPS: PropRow[] = [
    { name: `defaultOpen`, type: `boolean`, default: `false`, description: `Uncontrolled initial open state.` },
    { name: `open`, type: `boolean`, default: `—`, description: `Controlled open state. Pair with onOpenChange.` },
    { name: `onOpenChange`, type: `(open: boolean) => void`, default: `—`, description: `Fires whenever the open state changes.` },
    { name: `modal`, type: `boolean`, default: `true`, description: `When true, scroll outside the menu is locked.` }
];

const ITEM_PROPS: PropRow[] = [
    { name: `disabled`, type: `boolean`, default: `false`, description: `Disable this single item. Clicks are ignored; data-disabled is set.` },
    { name: `onSelect`, type: `(event: Event) => void`, default: `—`, description: `Fires when the user selects the item. Call event.preventDefault() to keep the menu open.` },
    { name: `inset`, type: `boolean`, default: `false`, description: `Add left padding to align with other indented items.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<DropdownMenuDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.dropdownMenu;
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

const TEST_FILE = `lib/components/ui/dropdown-menu.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.closedByDefault,
        testFile: TEST_FILE,
        testName: `is closed by default — no menu items rendered`,
        testLine: 28
    },
    {
        statement: statements.opensOnTrigger,
        testFile: TEST_FILE,
        testName: `opens when the trigger is clicked`,
        testLine: 33
    },
    {
        statement: statements.firesOnSelectAndCloses,
        testFile: TEST_FILE,
        testName: `fires onSelect when an item is clicked, then closes`,
        testLine: 41
    },
    {
        statement: statements.disabledData,
        testFile: TEST_FILE,
        testName: `disabled items are exposed via data-disabled`,
        testLine: 51
    },
    {
        statement: statements.closesOnEscape,
        testFile: TEST_FILE,
        testName: `closes on Escape`,
        testLine: 59
    },
    {
        statement: statements.labelNotMenuitem,
        testFile: TEST_FILE,
        testName: `label has role="presentation" (not a menuitem)`,
        testLine: 67
    }
];

export const DropdownMenuDocPage = () => {
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
                            example={dropdownMenuExampleById(`default`)}
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
                    <PropTable heading={`<DropdownMenu>`} rows={ROOT_PROPS} />
                    <PropTable heading={`<DropdownMenuItem>`} rows={ITEM_PROPS} />
                </div>
            </DocSection>
        </DocPage>
    );
};

export default DropdownMenuDocPage;
