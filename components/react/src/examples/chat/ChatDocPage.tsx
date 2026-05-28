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
import { chatExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    examples: `examples`,
    default: `examples-default`,
    endless: `examples-endless`,
    readOnly: `examples-read-only`,
    rtl: `rtl`,
    usage: `usage`,
    composition: `composition`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @my-own-web-services/react-components`;

const USAGE_SNIPPET = `import { Chat, type ChatMessage, type ChatUser } from "@my-own-web-services/react-components";

const USERS: Record<string, ChatUser> = {
    you: { id: "you", name: "You" },
    bob: { id: "bob", name: "Bob" }
};

const messages: ChatMessage[] = [
    { id: "1", authorId: "bob", body: "Hey!", createdAt: Date.now() - 60_000 },
    { id: "2", authorId: "you", body: "Hi Bob", createdAt: Date.now() }
];

<Chat
    messages={messages}
    users={USERS}
    currentUserId="you"
    onSend={({ body, replyToId }) => {/* append to your store */}}
/>`;

const COMPOSITION_SNIPPET = `// Endless backlog with paged loading
const [messages, setMessages] = useState<ChatMessage[]>(initialTail);
const [hasMore, setHasMore] = useState(true);
const [loadingOlder, setLoadingOlder] = useState(false);

const loadOlder = async () => {
    setLoadingOlder(true);
    const page = await api.messages.before(messages[0].id, 80);
    setMessages((prev) => [...page.messages, ...prev]);
    setHasMore(page.hasMore);
    setLoadingOlder(false);
    return page;
};

<Chat
    messages={messages}
    users={users}
    currentUserId={me.id}
    loadOlder={loadOlder}
    hasMore={hasMore}
    loadingOlder={loadingOlder}
    onSend={async ({ body, replyToId }) => {
        const optimistic: ChatMessage = {
            id: tempId(),
            authorId: me.id,
            body,
            replyToId,
            createdAt: Date.now(),
            pending: true
        };
        setMessages((prev) => [...prev, optimistic]);
        try {
            const saved = await api.messages.send({ body, replyToId });
            setMessages((prev) =>
                prev.map((m) => (m.id === optimistic.id ? saved : m))
            );
        } catch {
            setMessages((prev) =>
                prev.map((m) => (m.id === optimistic.id ? { ...m, pending: false, failed: true } : m))
            );
        }
    }}
    onReact={(id, emoji) => api.reactions.add(id, emoji)}
    onUnreact={(id, emoji) => api.reactions.remove(id, emoji)}
    onEdit={(id, body) => api.messages.edit(id, body)}
    onDelete={(id) => api.messages.delete(id)}
    typingUserIds={typingUsers}
/>`;

const CHAT_PROPS: PropRow[] = [
    { name: `messages`, type: `ReadonlyArray<ChatMessage>`, default: `—`, description: `Required. The full ordered list of messages, oldest first. The component never mutates this array — the consumer owns its data source.` },
    { name: `users`, type: `Record<string, ChatUser>`, default: `—`, description: `Required. Lookup of user id → user metadata. Used to resolve author names + avatars.` },
    { name: `currentUserId`, type: `string`, default: `—`, description: `Required. The id of the viewer. Drives "mine" styling, reaction toggle direction, and the typing-indicator exclusion.` },
    { name: `onSend`, type: `(input) => void | Promise<void>`, default: `—`, description: `Fires when the user submits the composer. Omitting it hides the composer entirely (read-only display).` },
    { name: `onEdit`, type: `(id, body) => void | Promise<void>`, default: `—`, description: `Inline-edit on a "mine" message. Called with the new body after the user presses Enter on the edit textarea.` },
    { name: `onDelete`, type: `(id) => void | Promise<void>`, default: `—`, description: `Per-row delete entry in the action menu (only on "mine" messages).` },
    { name: `onReact`, type: `(id, emoji) => void | Promise<void>`, default: `—`, description: `Fires when the user adds a reaction (clicks a chip not yet containing currentUserId, or picks one from the popover).` },
    { name: `onUnreact`, type: `(id, emoji) => void | Promise<void>`, default: `—`, description: `Fires when the user removes their own reaction (clicks a chip already containing currentUserId).` },
    { name: `onRetry`, type: `(id) => void | Promise<void>`, default: `—`, description: `Fires when the user clicks the retry affordance on a failed message.` },
    { name: `onMessageClick`, type: `(message) => void`, default: `—`, description: `Optional row-level click handler. Bubbles from anywhere inside the row except action buttons, links, and the edit textarea.` },
    { name: `loadOlder`, type: `() => Promise<ChatLoadOlderResponse> | void`, default: `—`, description: `Called when the visible window is near the top of the list and hasMore is true. The consumer prepends the returned messages to messages.` },
    { name: `hasMore`, type: `boolean`, default: `—`, description: `Drives the older-messages banner above the list. When false the banner becomes a "Beginning of conversation" footer.` },
    { name: `loadingOlder`, type: `boolean`, default: `false`, description: `Renders a loading spinner inside the older-messages banner while a page is in flight.` },
    { name: `typingUserIds`, type: `ReadonlyArray<string>`, default: `[]`, description: `User ids currently typing. The current user is filtered out automatically; the indicator label uses the user's display name from users.` },
    { name: `readOnly`, type: `boolean`, default: `false`, description: `Hides the composer and per-row action affordances. Reactions and replies become decorative only.` },
    { name: `showAvatars`, type: `boolean`, default: `true`, description: `Hide avatars + author headers for a compact list view.` },
    { name: `showDateDividers`, type: `boolean`, default: `true`, description: `Insert a date divider between messages whose calendar dates differ.` },
    { name: `groupConsecutiveMessages`, type: `boolean`, default: `true`, description: `Collapse consecutive messages from the same author (within a 5-minute window) so they share an avatar and header.` },
    { name: `availableReactions`, type: `ReadonlyArray<string>`, default: `["👍","❤️","😂","🎉","🤔","😢","🔥","👀"]`, description: `Quick-pick emoji set rendered in the reaction popover.` },
    { name: `maxBodyLength`, type: `number`, default: `—`, description: `Hard cap on the composer textarea length. When set, a character counter renders below the input.` },
    { name: `inputPlaceholder`, type: `string`, default: `—`, description: `Composer placeholder. Falls back to the localized default.` },
    { name: `emptyState`, type: `ReactNode`, default: `—`, description: `Custom empty-state content. Falls back to the localized "No messages yet" affordance.` },
    { name: `overscanCount`, type: `number`, default: `6`, description: `Number of items rendered outside the visible window. Higher values smooth fast scrolling at the cost of layout work.` },
    { name: `className`, type: `string`, default: `—`, description: `Extra classes on the outer wrapper.` },
    { name: `style`, type: `CSSProperties`, default: `—`, description: `Inline style on the outer wrapper.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) throw new Error(`<ChatDocPage> must be rendered inside <MowsProvider>`);
    return mowsContext.t.example.examples.chat;
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
                { id: ANCHOR.endless, label: doc.examples.endless.title },
                { id: ANCHOR.readOnly, label: doc.examples.readOnly.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title }
    ];
};

const TEST_FILE = `lib/components/chat/Chat/Chat.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    { statement: statements.rendersMessages, testFile: TEST_FILE, testName: `renders each message with author, body, and timestamp`, testLine: 40 },
    { statement: statements.emptyState, testFile: TEST_FILE, testName: `renders the empty state when there are no messages`, testLine: 35 },
    { statement: statements.sendOnEnter, testFile: TEST_FILE, testName: `sends the typed body and clears the composer on Enter`, testLine: 150 },
    { statement: statements.noSendOnShiftEnter, testFile: TEST_FILE, testName: `does not send on Shift+Enter (line break instead)`, testLine: 170 },
    { statement: statements.groupsConsecutive, testFile: TEST_FILE, testName: `groups consecutive messages from the same author within the window`, testLine: 118 },
    { statement: statements.insertsDateDividers, testFile: TEST_FILE, testName: `inserts date dividers between messages from different days`, testLine: 76 },
    { statement: statements.toggleReactions, testFile: TEST_FILE, testName: `renders reaction chips and toggles via onReact / onUnreact`, testLine: 233 },
    { statement: statements.replyPreview, testFile: TEST_FILE, testName: `shows a reply preview in the composer when reply is invoked`, testLine: 273 },
    { statement: statements.typingIndicator, testFile: TEST_FILE, testName: `shows the typing indicator with the typing user's name`, testLine: 314 },
    { statement: statements.retryOnFailure, testFile: TEST_FILE, testName: `renders the failed-send retry affordance and calls onRetry`, testLine: 341 },
    { statement: statements.loadsOlder, testFile: TEST_FILE, testName: `calls loadOlder when the list mounts near the top with hasMore`, testLine: 359 },
    { statement: statements.readOnlyHidesComposer, testFile: TEST_FILE, testName: `hides the composer when readOnly is true`, testLine: 204 }
];

export const ChatDocPage = () => {
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
                        <ExampleCard example={chatExampleById(`default`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.endless}
                        title={doc.examples.endless.title}
                        description={doc.examples.endless.description}
                    >
                        <ExampleCard example={chatExampleById(`endless`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.readOnly}
                        title={doc.examples.readOnly.title}
                        description={doc.examples.readOnly.description}
                    >
                        <ExampleCard example={chatExampleById(`readOnly`)} hideHeader />
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
                <ExampleCard example={chatExampleById(`rtl`)} hideHeader />
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
                <PropTable heading={`<Chat>`} rows={CHAT_PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default ChatDocPage;
