import * as React from "react";
import CodeViewer from "../../lib/components/code/codeViewer/CodeViewer";
import ExpandableCode from "../../lib/components/code/expandableCode/ExpandableCode";
import { type PageIndexItem } from "../../lib/components/navigation/pageIndex/PageIndex";
import { MowsContext } from "../../lib/lib/mowsContext/MowsContext";
import { DocPage, DocSection, DocSubsection } from "../examples/harness/docPage";

const ANCHOR = {
    overview: `overview`,
    overviewOneBlob: `overview-one-blob`,
    overviewCoreVsApp: `overview-core-vs-app`,
    overviewFutureSync: `overview-future-sync`,
    quickStart: `quick-start`,
    qsDefineSchema: `quick-start-define-schema`,
    qsRegisterSchema: `quick-start-register-schema`,
    qsReadWrite: `quick-start-read-write`,
    fields: `fields`,
    fieldsBuiltin: `fields-builtin`,
    fieldsCustom: `fields-custom`,
    panel: `panel`,
    panelGrouping: `panel-grouping`,
    panelJsonExport: `panel-json-export`,
    storage: `storage`,
    storageShape: `storage-shape`,
    storageMigration: `storage-migration`
} as const;

const DEFINE_SCHEMA_SNIPPET = `// filezSettings.ts
import { defineAppSettings } from "@my-own-web-services/react-components";

export const filezSettings = defineAppSettings({
    appKey: "filez",
    schema: {
        defaultView: {
            type: "select",
            options: [
                { value: "grid", label: (t) => t.filez.settings.viewGrid },
                { value: "list", label: (t) => t.filez.settings.viewList }
            ],
            default: "grid",
            label: (t) => t.filez.settings.defaultViewLabel,
            group: (t) => t.filez.settings.displayGroup
        },
        showHidden: {
            type: "boolean",
            default: false,
            label: (t) => t.filez.settings.showHiddenLabel,
            group: (t) => t.filez.settings.displayGroup
        },
        pageSize: {
            type: "slider",
            min: 10, max: 100, step: 10,
            default: 50,
            label: (t) => t.filez.settings.pageSizeLabel,
            group: (t) => t.filez.settings.behaviourGroup
        }
    }
});`;

const REGISTER_SCHEMA_SNIPPET = `// main.tsx
import { MowsProvider } from "@my-own-web-services/react-components";
import { filezSettings } from "./filezSettings";

<MowsProvider
    storagePrefix="filez"
    appSettings={filezSettings}
    // …
>
    <App />
</MowsProvider>`;

const READ_WRITE_SNIPPET = `import { useAppSetting } from "@my-own-web-services/react-components";
import { filezSettings } from "./filezSettings";

const FileList = () => {
    // Fully type-inferred:
    //   view:        "grid" | "list"
    //   setView:     (next: "grid" | "list") => void
    const [view, setView] = useAppSetting(filezSettings, "defaultView");
    const [showHidden, setShowHidden] = useAppSetting(filezSettings, "showHidden");

    return view === "grid"
        ? <Grid showHidden={showHidden} onToggleHidden={setShowHidden} />
        : <Table showHidden={showHidden} onToggleHidden={setShowHidden} />;
};`;

const CUSTOM_RENDER_SNIPPET = `// Inside a schema entry, override the row body:
themePreset: {
    type: "string",
    default: "default",
    label: (t) => t.app.themePresetLabel,
    render: ({ value, setValue, t }) => (
        <ThemePresetCarousel value={value} onChange={setValue} t={t} />
    )
}`;

const BLOB_SHAPE_SNIPPET = `// localStorage["\${storagePrefix}_settings"]
{
    "_v": 1,
    "core": {
        "theme": "dark",
        "codeTheme": "github-dark",
        "language": "de",
        "mapStyle": "openfreemap-liberty",
        "codeEditor": { "wrap": true, "showLineNumbers": true },
        "toast": { "position": "bottom-right" }
    },
    "device": {
        "hotkeyConfig": {
            "core.openSettings": { "keyCombinations": ["mod+,"] }
        },
        "recentActions": [
            { "actionId": "core.search", "timestamp": 1727712345678 }
        ]
    },
    "app": {
        "filez": { "defaultView": "list", "showHidden": true, "pageSize": 50 }
    }
}`;

const useGuideStrings = () => {
    const context = React.useContext(MowsContext);
    if (!context) {
        throw new Error(`<SettingsSystemGuide> must be rendered inside <MowsProvider>`);
    }
    return context.t.example.guides.settingsSystem;
};

const buildIndexItems = (
    t: ReturnType<typeof useGuideStrings>
): PageIndexItem[] => [
    {
        id: ANCHOR.overview,
        label: t.overview.title,
        children: [
            { id: ANCHOR.overviewOneBlob, label: t.overview.oneBlob.title },
            { id: ANCHOR.overviewCoreVsApp, label: t.overview.coreVsApp.title },
            { id: ANCHOR.overviewFutureSync, label: t.overview.futureSync.title }
        ]
    },
    {
        id: ANCHOR.quickStart,
        label: t.quickStart.title,
        children: [
            { id: ANCHOR.qsDefineSchema, label: t.quickStart.defineSchema.title },
            { id: ANCHOR.qsRegisterSchema, label: t.quickStart.registerSchema.title },
            { id: ANCHOR.qsReadWrite, label: t.quickStart.readWrite.title }
        ]
    },
    {
        id: ANCHOR.fields,
        label: t.fields.title,
        children: [
            { id: ANCHOR.fieldsBuiltin, label: t.fields.builtin.title },
            { id: ANCHOR.fieldsCustom, label: t.fields.custom.title }
        ]
    },
    {
        id: ANCHOR.panel,
        label: t.panel.title,
        children: [
            { id: ANCHOR.panelGrouping, label: t.panel.grouping.title },
            { id: ANCHOR.panelJsonExport, label: t.panel.jsonExport.title }
        ]
    },
    {
        id: ANCHOR.storage,
        label: t.storage.title,
        children: [
            { id: ANCHOR.storageShape, label: t.storage.shape.title },
            { id: ANCHOR.storageMigration, label: t.storage.migration.title }
        ]
    }
];

export const SettingsSystemGuide = () => {
    const t = useGuideStrings();
    const indexItems = React.useMemo(() => buildIndexItems(t), [t]);

    return (
        <DocPage indexItems={indexItems}>
            <DocSection
                id={ANCHOR.overview}
                title={t.overview.title}
                description={t.overview.intro}
            >
                <DocSubsection
                    id={ANCHOR.overviewOneBlob}
                    title={t.overview.oneBlob.title}
                    description={t.overview.oneBlob.body}
                />
                <DocSubsection
                    id={ANCHOR.overviewCoreVsApp}
                    title={t.overview.coreVsApp.title}
                    description={t.overview.coreVsApp.body}
                />
                <DocSubsection
                    id={ANCHOR.overviewFutureSync}
                    title={t.overview.futureSync.title}
                    description={t.overview.futureSync.body}
                />
            </DocSection>

            <DocSection
                id={ANCHOR.quickStart}
                title={t.quickStart.title}
                description={t.quickStart.intro}
            >
                <DocSubsection
                    id={ANCHOR.qsDefineSchema}
                    title={t.quickStart.defineSchema.title}
                    description={t.quickStart.defineSchema.body}
                >
                    <ExpandableCode>
                        <CodeViewer
                            code={DEFINE_SCHEMA_SNIPPET}
                            language={`tsx`}
                            fitContent
                        />
                    </ExpandableCode>
                </DocSubsection>
                <DocSubsection
                    id={ANCHOR.qsRegisterSchema}
                    title={t.quickStart.registerSchema.title}
                    description={t.quickStart.registerSchema.body}
                >
                    <ExpandableCode>
                        <CodeViewer
                            code={REGISTER_SCHEMA_SNIPPET}
                            language={`tsx`}
                            fitContent
                        />
                    </ExpandableCode>
                </DocSubsection>
                <DocSubsection
                    id={ANCHOR.qsReadWrite}
                    title={t.quickStart.readWrite.title}
                    description={t.quickStart.readWrite.body}
                >
                    <ExpandableCode>
                        <CodeViewer
                            code={READ_WRITE_SNIPPET}
                            language={`tsx`}
                            fitContent
                        />
                    </ExpandableCode>
                </DocSubsection>
            </DocSection>

            <DocSection
                id={ANCHOR.fields}
                title={t.fields.title}
                description={t.fields.intro}
            >
                <DocSubsection
                    id={ANCHOR.fieldsBuiltin}
                    title={t.fields.builtin.title}
                    description={t.fields.builtin.body}
                />
                <DocSubsection
                    id={ANCHOR.fieldsCustom}
                    title={t.fields.custom.title}
                    description={t.fields.custom.body}
                >
                    <ExpandableCode>
                        <CodeViewer
                            code={CUSTOM_RENDER_SNIPPET}
                            language={`tsx`}
                            fitContent
                        />
                    </ExpandableCode>
                </DocSubsection>
            </DocSection>

            <DocSection
                id={ANCHOR.panel}
                title={t.panel.title}
                description={t.panel.intro}
            >
                <DocSubsection
                    id={ANCHOR.panelGrouping}
                    title={t.panel.grouping.title}
                    description={t.panel.grouping.body}
                />
                <DocSubsection
                    id={ANCHOR.panelJsonExport}
                    title={t.panel.jsonExport.title}
                    description={t.panel.jsonExport.body}
                />
            </DocSection>

            <DocSection
                id={ANCHOR.storage}
                title={t.storage.title}
                description={t.storage.intro}
            >
                <DocSubsection
                    id={ANCHOR.storageShape}
                    title={t.storage.shape.title}
                    description={t.storage.shape.body}
                >
                    <ExpandableCode>
                        <CodeViewer
                            code={BLOB_SHAPE_SNIPPET}
                            language={`json`}
                            fitContent
                        />
                    </ExpandableCode>
                </DocSubsection>
                <DocSubsection
                    id={ANCHOR.storageMigration}
                    title={t.storage.migration.title}
                    description={t.storage.migration.body}
                />
            </DocSection>
        </DocPage>
    );
};

export default SettingsSystemGuide;
