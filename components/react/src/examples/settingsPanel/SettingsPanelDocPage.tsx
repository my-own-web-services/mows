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
import { settingsPanelExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    appExtension: `app-extension`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @my-own-web-services/react-components`;

const USAGE_SNIPPET = `import { SettingsPanel } from "@my-own-web-services/react-components";

<SettingsPanel />`;

const COMPOSITION_SNIPPET = `// Place SettingsPanel inside a sized container — it fills its parent.
// Typical use is inside the settings modal, but any 640px+-tall surface works.

<div className="h-[640px]">
    <SettingsPanel />
</div>`;

const APP_EXTENSION_SNIPPET = `// 1. Declare your app's settings schema once.
import { defineAppSettings } from "@my-own-web-services/react-components";

export const filezSettings = defineAppSettings({
    appKey: "filez",
    schema: {
        defaultView: {
            type: "select",
            options: [
                { value: "grid", label: (t) => t.filez.viewGrid },
                { value: "list", label: (t) => t.filez.viewList }
            ],
            default: "grid",
            label: (t) => t.filez.defaultViewLabel,
            group: (t) => t.filez.displayGroup
        },
        showHidden: {
            type: "boolean",
            default: false,
            label: (t) => t.filez.showHiddenLabel,
            group: (t) => t.filez.displayGroup
        }
    }
});

// 2. Register it on MowsProvider — done once at app boot.
<MowsProvider appSettings={filezSettings} storagePrefix="filez">
    <App />
</MowsProvider>

// 3. SettingsPanel auto-renders one section per declared group, with the
//    right primitive per type. No additional panel wiring needed.`;

const PROPS: PropRow[] = [
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
        throw new Error(`<SettingsPanelDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.settingsPanel;
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
        { id: ANCHOR.appExtension, label: doc.appExtension.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/settings/settingsPanel/SettingsPanel.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.threeHeadings,
        testFile: TEST_FILE,
        testName: `renders the three section headings`,
        testLine: 202
    },
    {
        statement: statements.standalonePickersShowCurrent,
        testFile: TEST_FILE,
        testName: `uses the standalone-style theme/code-theme/language pickers and shows their current values`,
        testLine: 209
    },
    {
        statement: statements.jsonTabShowsSettings,
        testFile: TEST_FILE,
        testName: `switches to the JSON tab and shows the unified settings blob`,
        testLine: 219
    },
    {
        statement: statements.jsonSaveAppliesEdit,
        testFile: TEST_FILE,
        testName: `pastes a wholesale blob into the JSON tab and calls replaceBlob`,
        testLine: 238
    },
    {
        statement: statements.jsonRejectsBadVersion,
        testFile: TEST_FILE,
        testName: `rejects a JSON paste whose _v doesn't match the current version`,
        testLine: 264
    },
    {
        statement: statements.notificationsSection,
        testFile: TEST_FILE,
        testName: `renders the Notifications section with the toast position picker`,
        testLine: 290
    },
    {
        statement: statements.jsonIncludesToast,
        testFile: TEST_FILE,
        testName: `exposes the toast slot inside core in the JSON view`,
        testLine: 297
    },
    {
        statement: statements.toastPositionFromJson,
        testFile: TEST_FILE,
        testName: `a pasted blob with core.toast lands in the manager after save`,
        testLine: 310
    },
    {
        statement: statements.bracketPairToggle,
        testFile: TEST_FILE,
        testName: `exposes a bracket-pair colorization toggle that calls setCodeEditorSettings`,
        testLine: 341
    },
    {
        statement: statements.appSectionWhenRegistered,
        testFile: TEST_FILE,
        testName: `renders an app-settings section when a schema is registered`,
        testLine: 436
    },
    {
        statement: statements.jsonErrorOnInvalid,
        testFile: TEST_FILE,
        testName: `shows an error when JSON is invalid`,
        testLine: 529
    }
];

export const SettingsPanelDocPage = () => {
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
                            example={settingsPanelExampleById(`default`)}
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
                id={ANCHOR.appExtension}
                title={doc.appExtension.title}
                description={doc.appExtension.body}
            >
                <ExpandableCode>
                    <CodeViewer
                        code={APP_EXTENSION_SNIPPET}
                        language={`tsx`}
                        fitContent
                    />
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
                <PropTable heading={`<SettingsPanel>`} rows={PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default SettingsPanelDocPage;
