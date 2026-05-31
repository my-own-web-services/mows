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
import { shareDialogExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    examples: `examples`,
    default: `examples-default`,
    allowDeny: `examples-allow-deny`,
    publicOnly: `examples-public-only`,
    usage: `usage`,
    composition: `composition`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @my-own-web-services/react-components`;

const USAGE_SNIPPET = `import { ShareDialog } from "@my-own-web-services/react-components";

<ShareDialog
    open={open}
    onOpenChange={setOpen}
    resourceLabel="channel #team-room"
    subjects={subjects}            // ShareSubjectOption[]
    actions={actions}              // ShareActionOption[]
    onShare={async (input) => {
        // input = { subject, actions[], effect: "Allow" | "Deny" }
        // Caller turns this into the actual POST /access_policies/create.
        await myApi.shareChannel(input);
    }}
/>`;

const COMPOSITION_SNIPPET = `// Implicit action grouping — "Read implies List" so checking Read
// auto-checks List. Without this, you can ship a "Read but invisible
// in sidebar" policy by accident (the chat review B2 / SEC-4 bug).
const actions: ShareActionOption[] = [
    {
        id: "ChannelsRead",
        label: "Read",
        description: "Read messages",
        implies: ["ChannelsList"]
    },
    { id: "ChannelsList", label: "List only", description: "Sidebar visibility only" },
    { id: "ChannelsPublish", label: "Publish", description: "Send messages" }
];

// Exclude self from the picker — a user can't share with themselves.
<ShareDialog
    subjects={allSubjects}
    excludeSubjectIds={[actingUserId]}
    actions={actions}
    allowDeny                                 // opt into Deny precedence
    initialActionIds={["ChannelsRead"]}      // pre-checks Read + List
    onShare={async (input) => { /* … */ }}
/>`;

const PROPS: PropRow[] = [
    { name: `open`, type: `boolean`, default: `—`, description: `Controlled open state.` },
    { name: `onOpenChange`, type: `(open: boolean) => void`, default: `—`, description: `Fires whenever the dialog opens or closes.` },
    { name: `resourceLabel`, type: `string`, default: `—`, description: `Free-form resource label — rendered verbatim after the title prefix.` },
    { name: `resourceDescription`, type: `ReactNode`, default: `—`, description: `Optional secondary line under the title. Falls back to the subject-section heading so Radix's aria-describedby contract always holds.` },
    { name: `subjects`, type: `ShareSubjectOption[]`, default: `—`, description: `All shareable subjects the caller has access to — grouped by kind into the tab bar.` },
    { name: `actions`, type: `ShareActionOption[]`, default: `—`, description: `Per-consumer action vocabulary. Optional implies arrays propagate auto-check.` },
    { name: `excludeSubjectIds`, type: `string[]`, default: `[]`, description: `Subject ids to hide from the picker (e.g. the acting user's own id).` },
    { name: `initialSubjectId`, type: `string`, default: `first available subject`, description: `Subject pre-selected on open. Falls through if it doesn't match any supplied subject.` },
    { name: `initialActionIds`, type: `string[]`, default: `[]`, description: `Actions pre-checked on open. Implications are applied on top so "Read" pre-checks "List".` },
    { name: `allowDeny`, type: `boolean`, default: `false`, description: `Render the Allow / Deny effect toggle. Off by default — Deny is a precedence override that callers opt into.` },
    { name: `onShare`, type: `(input: ShareDialogSubmit) => Promise<void>`, default: `—`, description: `Caller's submit handler. Throw to surface an error inline and keep the dialog open; resolve to close + reset.` },
    { name: `strings`, type: `Partial<ShareDialogStrings>`, default: `English defaults`, description: `Optional string overrides for the consuming app's i18n layer.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext)
        throw new Error(`<ShareDialogDocPage> must be rendered inside <MowsProvider>`);
    return mowsContext.t.example.examples.shareDialog;
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
                { id: ANCHOR.allowDeny, label: doc.examples.allowDeny.title },
                { id: ANCHOR.publicOnly, label: doc.examples.publicOnly.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title }
    ];
};

const TEST_FILE = `lib/components/identity/shareDialog/ShareDialog.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    { statement: statements.rendersResourceLabel, testFile: TEST_FILE, testName: `renders the resource label in the title`, testLine: 74 },
    { statement: statements.tabPerSubjectKind, testFile: TEST_FILE, testName: `surfaces every subject kind that has at least one option as its own tab`, testLine: 79 },
    { statement: statements.hidesEmptyKindTabs, testFile: TEST_FILE, testName: `does NOT render a tab for a kind with zero subjects`, testLine: 94 },
    { statement: statements.excludesSubjectIds, testFile: TEST_FILE, testName: `excludes ids supplied via excludeSubjectIds (the acting-user filter)`, testLine: 102 },
    { statement: statements.impliedActionsAutoCheck, testFile: TEST_FILE, testName: `auto-checks implied actions when a parent action is checked`, testLine: 112 },
    { statement: statements.uncheckDoesNotCascade, testFile: TEST_FILE, testName: `does NOT cascade an uncheck back through implications`, testLine: 128 },
    { statement: statements.blocksWithoutSubject, testFile: TEST_FILE, testName: `blocks submit until a subject is picked`, testLine: 147 },
    { statement: statements.blocksWithoutAction, testFile: TEST_FILE, testName: `blocks submit until at least one action is checked`, testLine: 175 },
    { statement: statements.actionsOrderedByProp, testFile: TEST_FILE, testName: `returns actions in the prop-defined order, not click-order`, testLine: 189 },
    { statement: statements.allowDenyToggleGated, testFile: TEST_FILE, testName: `renders the Allow/Deny toggle only when allowDeny is true`, testLine: 207 },
    { statement: statements.publicSentinelAutoSelects, testFile: TEST_FILE, testName: `auto-selects the sentinel subject when the Public tab is picked`, testLine: 226 },
    { statement: statements.surfaceErrorOnReject, testFile: TEST_FILE, testName: `keeps the dialog open and surfaces the error message when onShare rejects`, testLine: 239 },
    { statement: statements.resetsOnReopen, testFile: TEST_FILE, testName: `resets the form state on each re-open`, testLine: 261 }
];

export const ShareDialogDocPage = () => {
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
                            example={shareDialogExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.allowDeny}
                        title={doc.examples.allowDeny.title}
                        description={doc.examples.allowDeny.description}
                    >
                        <ExampleCard
                            example={shareDialogExampleById(`allowDeny`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.publicOnly}
                        title={doc.examples.publicOnly.title}
                        description={doc.examples.publicOnly.description}
                    >
                        <ExampleCard
                            example={shareDialogExampleById(`publicOnly`)}
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

            <DocSection id={ANCHOR.rtl} title={doc.rtl.title} description={doc.rtl.body}>
                <ExampleCard
                    example={shareDialogExampleById(`rtl`)}
                    hideHeader
                />
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
                <PropTable heading={`<ShareDialog>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default ShareDialogDocPage;
