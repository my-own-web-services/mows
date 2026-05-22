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
import { primaryMenuExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    inline: `examples-inline`,
    fixed: `examples-fixed`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @mows/react-components`;

const USAGE_SNIPPET = `import { PrimaryMenu } from "@mows/react-components";

<PrimaryMenu />`;

const COMPOSITION_SNIPPET = `// PrimaryMenu lives inside <MowsProvider>. It pulls the active user / theme /
// language / code-theme / keyboard-shortcut entries from context.

<MowsProvider storagePrefix="my-app">
    {/* fixed top-right, the default — pin to viewport corner */}
    <PrimaryMenu />

    {/* inline (full-width trigger), e.g. inside <SidebarFooter> */}
    <PrimaryMenu variant="inline" user={{ displayName: "Ada" }} />
</MowsProvider>`;

const PRIMARY_MENU_PROPS: PropRow[] = [
    {
        name: `variant`,
        type: `"fixed" | "inline"`,
        default: `"fixed"`,
        description: `"fixed" pins the trigger to a viewport corner; "inline" renders a full-width trigger that fits inside a sidebar footer or row.`
    },
    {
        name: `position`,
        type: `"top-right" | "top-left" | "bottom-right" | "bottom-left"`,
        default: `"top-right"`,
        description: `Which viewport corner the fixed variant pins to. Ignored when variant="inline".`
    },
    {
        name: `defaultOpen`,
        type: `boolean`,
        default: `false`,
        description: `Open the dropdown on first mount. Useful for stories / docs.`
    },
    {
        name: `user`,
        type: `{ displayName?: string; id?: string }`,
        default: `—`,
        description: `Identity shown when the user is signed in. The displayName appears in the inline trigger and atop the menu; id is exposed via <CopyValueButton>.`
    },
    {
        name: `loading`,
        type: `boolean`,
        default: `false`,
        description: `Render nothing while the app is still resolving auth state.`
    },
    {
        name: `showSwitchUser`,
        type: `boolean`,
        default: `false`,
        description: `Add a "Switch user" entry next to "Log out" for apps that support multiple identities.`
    },
    {
        name: `extraItems`,
        type: `ReactNode`,
        default: `—`,
        description: `Extra <DropdownMenuItem>s appended after the standard entries.`
    },
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes on the outer wrapper.`
    },
    {
        name: `style`,
        type: `CSSProperties`,
        default: `—`,
        description: `Inline style on the outer wrapper.`
    }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<PrimaryMenuDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.primaryMenu;
};

type PrimaryMenuStrings = ReturnType<typeof useDocStrings>;

const buildIndexItems = (t: PrimaryMenuStrings): PageIndexItem[] => {
    const doc = t.doc;
    return [
        { id: ANCHOR.installation, label: doc.installation.title },
        {
            id: ANCHOR.examples,
            label: doc.examples.title,
            children: [
                { id: ANCHOR.inline, label: doc.examples.inline.title },
                { id: ANCHOR.fixed, label: doc.examples.fixed.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/appShell/primaryMenu/PrimaryMenu.test.tsx`;

const buildBehaviourEntries = (
    statements: PrimaryMenuStrings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.loginVisibleWhenAuthConfigured,
        testFile: TEST_FILE,
        testName: `renders the Login item when auth is configured and the user is not signed in`,
        testLine: 77
    },
    {
        statement: statements.loginHiddenWhenAuthNotConfigured,
        testFile: TEST_FILE,
        testName: `hides the Login item when auth is not configured`,
        testLine: 84
    },
    {
        statement: statements.providerWithoutOidcYieldsNoAuth,
        testFile: TEST_FILE,
        testName: `real MowsProvider mounted without an oidc prop yields authConfigured=false`,
        testLine: 91
    },
    {
        statement: statements.dropsLeadingSeparator,
        testFile: TEST_FILE,
        testName: `drops the leading separator when there is no auth section above it`,
        testLine: 113
    },
    {
        statement: statements.keepsSeparatorWithLogin,
        testFile: TEST_FILE,
        testName: `keeps the separator when the Login item is visible`,
        testLine: 150
    },
    {
        statement: statements.inlineRendersFullWidth,
        testFile: TEST_FILE,
        testName: `inline variant renders trigger full-width without fixed positioning and shows the user name when logged in`,
        testLine: 173
    },
    {
        statement: statements.inlineLoggedOutMenuIcon,
        testFile: TEST_FILE,
        testName: `inline variant renders the menu icon (no text label) + chevron when logged out`,
        testLine: 186
    },
    {
        statement: statements.staleSessionTreatedAsLoggedOut,
        testFile: TEST_FILE,
        testName: `treats an authenticated session as logged out when auth is not configured`,
        testLine: 244
    }
];

export const PrimaryMenuDocPage = () => {
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
                        id={ANCHOR.inline}
                        title={doc.examples.inline.title}
                        description={doc.examples.inline.description}
                    >
                        <ExampleCard
                            example={primaryMenuExampleById(`inline`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.fixed}
                        title={doc.examples.fixed.title}
                        description={doc.examples.fixed.description}
                    >
                        <ExampleCard
                            example={primaryMenuExampleById(`fixed`)}
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
                <PropTable heading={`<PrimaryMenu>`} rows={PRIMARY_MENU_PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default PrimaryMenuDocPage;
