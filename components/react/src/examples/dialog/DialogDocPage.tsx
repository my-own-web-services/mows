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
import { dialogExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    usage: `usage`,
    composition: `composition`,
    examples: `examples`,
    default: `examples-default`,
    hideClose: `examples-hide-close`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add mows-components-react`;

const USAGE_SNIPPET = `import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogClose
} from "mows-components-react";

<Dialog>
    <DialogTrigger asChild>
        <Button>Open</Button>
    </DialogTrigger>
    <DialogContent>
        <DialogHeader>
            <DialogTitle>Title</DialogTitle>
            <DialogDescription>Description</DialogDescription>
        </DialogHeader>
        <DialogFooter>
            <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button>Confirm</Button>
        </DialogFooter>
    </DialogContent>
</Dialog>`;

const COMPOSITION_SNIPPET = `// DialogContent automatically renders a corner close button — pass
// showCloseButton={false} to hide it. Escape and clicking the overlay also
// close the dialog (Radix default).

<Dialog defaultOpen>
    <DialogContent showCloseButton={false}>
        ...
    </DialogContent>
</Dialog>`;

const ROOT_PROPS: PropRow[] = [
    { name: `open`, type: `boolean`, default: `—`, description: `Controlled open state. Pair with onOpenChange.` },
    { name: `defaultOpen`, type: `boolean`, default: `false`, description: `Uncontrolled initial open state.` },
    { name: `onOpenChange`, type: `(open: boolean) => void`, default: `—`, description: `Fires whenever the open state changes (trigger, overlay click, Escape, close button).` },
    { name: `modal`, type: `boolean`, default: `true`, description: `When true, scroll outside the dialog is locked and focus is trapped inside.` }
];

const CONTENT_PROPS: PropRow[] = [
    { name: `showCloseButton`, type: `boolean`, default: `true`, description: `Render the corner X close button. Set false to require an explicit action.` },
    { name: `className`, type: `string`, default: `—`, description: `Extra classes on the dialog surface.` },
    { name: `...rest`, type: `ComponentProps<typeof DialogPrimitive.Content>`, default: `—`, description: `All other Radix Dialog.Content props forward (onEscapeKeyDown, onPointerDownOutside, …).` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<DialogDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.dialog;
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
                { id: ANCHOR.hideClose, label: doc.examples.hideClose.title }
            ]
        },
        { id: ANCHOR.usage, label: doc.usage.title },
        { id: ANCHOR.composition, label: doc.composition.title },
        { id: ANCHOR.rtl, label: doc.rtl.title },
        { id: ANCHOR.definedBehaviour, label: doc.definedBehaviour.title },
        { id: ANCHOR.apiReference, label: doc.apiReference.title },
    ];
};

const TEST_FILE = `lib/components/ui/dialog.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.closedByDefault,
        testFile: TEST_FILE,
        testName: `is closed by default — content is not rendered`,
        testLine: 31
    },
    {
        statement: statements.defaultOpen,
        testFile: TEST_FILE,
        testName: `renders the content when defaultOpen is set`,
        testLine: 36
    },
    {
        statement: statements.opensOnTrigger,
        testFile: TEST_FILE,
        testName: `opens when the trigger is clicked`,
        testLine: 44
    },
    {
        statement: statements.ariaWiring,
        testFile: TEST_FILE,
        testName: `exposes role="dialog" with the title + description wired into aria`,
        testLine: 51
    },
    {
        statement: statements.closeButton,
        testFile: TEST_FILE,
        testName: `renders a built-in close button labelled "Close"`,
        testLine: 62
    },
    {
        statement: statements.closesOnEscape,
        testFile: TEST_FILE,
        testName: `closes on Escape`,
        testLine: 70
    }
];

export const DialogDocPage = () => {
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
                            example={dialogExampleById(`default`)}
                            hideHeader
                        />
                    </DocSubsection>
                    <DocSubsection
                        id={ANCHOR.hideClose}
                        title={doc.examples.hideClose.title}
                        description={doc.examples.hideClose.description}
                    >
                        <ExampleCard
                            example={dialogExampleById(`hideClose`)}
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
                <div className={`flex flex-col gap-8`}>
                    <PropTable heading={`<Dialog>`} rows={ROOT_PROPS} />
                    <PropTable heading={`<DialogContent>`} rows={CONTENT_PROPS} />
                </div>
            </DocSection>
        </DocPage>
    );
};

export default DialogDocPage;
