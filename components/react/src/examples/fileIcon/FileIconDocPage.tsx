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
import { fileIconExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    sizes: `examples-sizes`,
    fallback: `examples-fallback`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add mows-components-react`;

const USAGE_SNIPPET = `import { FileIcon } from "mows-components-react";

<FileIcon fileName="package.json" />
<FileIcon fileName="Dockerfile" />
<FileIcon fileName="image.png" size={32} />`;

const COMPOSITION_SNIPPET = `// FileIcon resolves a filename to a Material file icon URL
// (bundled as Vite assets) and renders it as an <img>. If the SVG
// fails to load, a lucide File glyph is shown instead.

<div className="grid grid-cols-6 gap-3">
    {filenames.map((name) => (
        <div key={name} className="flex flex-col items-center gap-1">
            <FileIcon fileName={name} size={32} />
            <span className="text-xs text-muted-foreground">{name}</span>
        </div>
    ))}
</div>`;

const FILE_ICON_PROPS: PropRow[] = [
    {
        name: `fileName`,
        type: `string`,
        default: `(required)`,
        description: `File name (with or without path). Resolution tries exact name → extension → generic fallback.`
    },
    {
        name: `size`,
        type: `number`,
        default: `—`,
        description: `Pixel size applied to both width and height on the rendered <img>.`
    },
    {
        name: `className`,
        type: `string`,
        default: `—`,
        description: `Extra classes on the wrapper.`
    },
    {
        name: `style`,
        type: `CSSProperties`,
        default: `—`,
        description: `Extra inline styles on the wrapper.`
    }
];

const useDocStrings = () => {
    const ctx = React.useContext(MowsContext);
    if (!ctx) {
        throw new Error(`<FileIconDocPage> must be rendered inside <MowsProvider>`);
    }
    return ctx.t.example.examples.fileIcon;
};

type FileIconStrings = ReturnType<typeof useDocStrings>;

const buildIndexItems = (t: FileIconStrings): PageIndexItem[] => {
    const doc = t.doc;
    return [
        { id: ANCHOR.installation, label: doc.installation.title },
        {
            id: ANCHOR.examples,
            label: doc.examples.title,
            children: [
                { id: ANCHOR.default, label: doc.examples.default.title },
                { id: ANCHOR.sizes, label: doc.examples.sizes.title },
                { id: ANCHOR.fallback, label: doc.examples.fallback.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/files/fileIcon/FileIcon.test.tsx`;

const buildBehaviourEntries = (
    statements: FileIconStrings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.resolvesAll,
        testFile: TEST_FILE,
        testName: `resolves extensions, exact names, and the default fallback`,
        testLine: 10
    },
    {
        statement: statements.extension,
        testFile: TEST_FILE,
        testName: `resolves a file extension to the matching icon`,
        testLine: 20
    },
    {
        statement: statements.exactName,
        testFile: TEST_FILE,
        testName: `prefers an exact file-name match over extension`,
        testLine: 27
    },
    {
        statement: statements.defaultFallback,
        testFile: TEST_FILE,
        testName: `renders the default file icon for unknown extensions`,
        testLine: 38
    },
    {
        statement: statements.sizeForwarded,
        testFile: TEST_FILE,
        testName: `forwards the size prop to the rendered image`,
        testLine: 46
    },
    {
        statement: statements.rerendersOnFileName,
        testFile: TEST_FILE,
        testName: `re-resolves when fileName changes`,
        testLine: 53
    },
    {
        statement: statements.lucideFallback,
        testFile: TEST_FILE,
        testName: `switches to the lucide fallback when the image load fails`,
        testLine: 62
    }
];

export const FileIconDocPage = () => {
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
                        <ExampleCard example={fileIconExampleById(`default`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.sizes}
                        title={doc.examples.sizes.title}
                        description={doc.examples.sizes.description}
                    >
                        <ExampleCard example={fileIconExampleById(`sizes`)} hideHeader />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.fallback}
                        title={doc.examples.fallback.title}
                        description={doc.examples.fallback.description}
                    >
                        <ExampleCard example={fileIconExampleById(`fallback`)} hideHeader />
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
                <PropTable heading={`<FileIcon>`} rows={FILE_ICON_PROPS} />
            </DocSection>
        </DocPage>
    );
};

export default FileIconDocPage;
