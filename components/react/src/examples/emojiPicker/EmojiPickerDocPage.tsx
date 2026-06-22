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
import { emojiPickerExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    examples: `examples`,
    default: `examples-default`,
    inPopover: `examples-in-popover`,
    rtl: `rtl`,
    usage: `usage`,
    composition: `composition`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @my-own-web-services/react-components`;

const USAGE_SNIPPET = `import { EmojiPicker } from "@my-own-web-services/react-components";

<EmojiPicker onSelect={(emoji) => setInputValue((v) => v + emoji)} />`;

const COMPOSITION_SNIPPET = `// Mount inside a Popover for a "click-to-pick" flow
import { Smile } from "lucide-react";
import {
    EmojiPicker,
    Button,
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@my-own-web-services/react-components";

const [open, setOpen] = useState(false);

<Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
            <Smile /> Add emoji
        </Button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-auto overflow-hidden p-0">
        <EmojiPicker
            onSelect={(emoji) => {
                insertAtCursor(emoji);
                setOpen(false);
            }}
            className="border-0 shadow-none"
        />
    </PopoverContent>
</Popover>`;

const EMOJI_PICKER_PROPS: PropRow[] = [
    { name: `onSelect`, type: `(emoji: string, entry: EmojiEntry) => void`, default: `—`, description: `Required. Fires when the user picks an emoji. The first argument is the final string with any active skin-tone modifier already applied; the second is the raw entry metadata.` },
    { name: `onClose`, type: `() => void`, default: `—`, description: `Called when the user presses Escape with an already-empty search input. Use for dismissing a wrapping popover.` },
    { name: `skinTone`, type: `0 | 1 | 2 | 3 | 4 | 5`, default: `—`, description: `Controlled skin tone. When provided, the internal state and localStorage persistence are bypassed and the picker reflects this value.` },
    { name: `onSkinToneChange`, type: `(tone) => void`, default: `—`, description: `Notification when the user picks a new tone from the swatch menu.` },
    { name: `hideRecent`, type: `boolean`, default: `false`, description: `Hide the recently-used row even when there are entries in storage.` },
    { name: `hideSearch`, type: `boolean`, default: `false`, description: `Hide the search input. Useful for compact embeds.` },
    { name: `hideSkinTone`, type: `boolean`, default: `false`, description: `Hide the skin-tone trigger. The picker still respects skinTone if controlled.` },
    { name: `columns`, type: `number`, default: `9`, description: `Number of columns in the emoji grid. Drives the gridTemplateColumns CSS property; the cells auto-fit the available width.` },
    { name: `maxRecent`, type: `number`, default: `24`, description: `Maximum number of recents kept in localStorage.` },
    { name: `storagePrefix`, type: `string | null`, default: `"mows-emoji-picker"`, description: `localStorage key prefix for recents and skin-tone persistence. Pass null to disable persistence entirely (useful for tests or ephemeral surfaces).` },
    { name: `height`, type: `number`, default: `360`, description: `Overall pixel height of the picker.` },
    { name: `strings`, type: `Partial<EmojiPickerStrings>`, default: `—`, description: `Override copy for the search placeholder, category names, "no results" state, etc. Missing keys fall back to the English defaults.` },
    { name: `className`, type: `string`, default: `—`, description: `Extra classes on the outer wrapper.` },
    { name: `style`, type: `CSSProperties`, default: `—`, description: `Inline style on the outer wrapper.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) throw new Error(`<EmojiPickerDocPage> must be rendered inside <MowsProvider>`);
    return mowsContext.t.example.examples.emojiPicker;
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
                { id: ANCHOR.inPopover, label: doc.examples.inPopover.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title }
    ];
};

const TEST_FILE = `lib/components/input/emojiPicker/EmojiPicker.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    { statement: statements.rendersShell, testFile: TEST_FILE, testName: `renders the picker shell with search + categories`, testLine: 79 },
    { statement: statements.searchFilters, testFile: TEST_FILE, testName: `searching narrows the result set to a flat grid`, testLine: 123 },
    { statement: statements.noResultsState, testFile: TEST_FILE, testName: `shows the no-results state for an unmatched query`, testLine: 133 },
    { statement: statements.onSelectFires, testFile: TEST_FILE, testName: `fires onSelect with the picked emoji string`, testLine: 98 },
    { statement: statements.appliesSkinTone, testFile: TEST_FILE, testName: `applies the active skin tone to skin-toneable emojis`, testLine: 112 },
    { statement: statements.persistsRecents, testFile: TEST_FILE, testName: `persists picked emojis to localStorage under the storagePrefix`, testLine: 163 },
    { statement: statements.dedupesRecents, testFile: TEST_FILE, testName: `dedupes the recents row by base character`, testLine: 183 },
    { statement: statements.clearSearchButton, testFile: TEST_FILE, testName: `clicking the clear-search button empties the query`, testLine: 230 },
    { statement: statements.escapeFlow, testFile: TEST_FILE, testName: `Escape clears the query before invoking onClose`, testLine: 149 },
    { statement: statements.hidesSearch, testFile: TEST_FILE, testName: `hides the search bar when hideSearch is true`, testLine: 86 },
    { statement: statements.hidesSkinTone, testFile: TEST_FILE, testName: `hides the skin-tone toggle when hideSkinTone is true`, testLine: 91 },
    { statement: statements.configurableColumns, testFile: TEST_FILE, testName: `exposes a configurable column count via the grid style`, testLine: 224 }
];

export const EmojiPickerDocPage = () => {
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
                        <ExampleCard example={emojiPickerExampleById(`default`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.inPopover}
                        title={doc.examples.inPopover.title}
                        description={doc.examples.inPopover.description}
                    >
                        <ExampleCard example={emojiPickerExampleById(`inPopover`)} hideHeader />
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

            <DocSection id={ANCHOR.rtl} title={doc.rtl.title} description={doc.rtl.body}>
                <ExampleCard example={emojiPickerExampleById(`rtl`)} hideHeader />
            </DocSection>

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
                <PropTable heading={`<EmojiPicker>`} rows={EMOJI_PICKER_PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default EmojiPickerDocPage;
