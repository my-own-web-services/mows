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
import { nodeEditorExampleById } from "./index";

const ANCHOR = {
    installation: `installation`,
    examples: `examples`,
    default: `examples-default`,
    usage: `usage`,
    composition: `composition`,
    rtl: `rtl`,
    definedBehaviour: `defined-behaviour`,
    apiReference: `api-reference`
} as const;

const PACKAGE_INSTALL = `add @my-own-web-services/react-components`;

const USAGE_SNIPPET = `import { useState, useCallback } from "react";
import { addEdge, applyEdgeChanges, applyNodeChanges } from "@xyflow/react";
import { NodeEditor } from "@my-own-web-services/react-components";

const initialNodes = [
    {
        id: "a",
        type: "typed",
        position: { x: 0, y: 0 },
        data: {
            label: "Input",
            outputs: [{ id: "out", type: "number", label: "value" }],
            body: <span>42</span>
        }
    },
    {
        id: "b",
        type: "typed",
        position: { x: 300, y: 0 },
        data: {
            label: "Output",
            inputs: [{ id: "in", type: "number", label: "value" }]
        }
    }
];

const Example = () => {
    const [nodes, setNodes] = useState(initialNodes);
    const [edges, setEdges] = useState([]);

    return (
        <NodeEditor
            nodes={nodes}
            edges={edges}
            onNodesChange={(c) => setNodes((n) => applyNodeChanges(c, n))}
            onEdgesChange={(c) => setEdges((e) => applyEdgeChanges(c, e))}
            onConnect={(c) => setEdges((e) => addEdge(c, e))}
        />
    );
};`;

const COMPOSITION_SNIPPET = `// TypedHandle declares a strict-equality port type. Connections between
// two TypedHandles are only allowed when their portTypes are equal.
// Mixing a TypedHandle with a bare <Handle> is rejected.

import { TypedHandle } from "@my-own-web-services/react-components";
import { Position } from "@xyflow/react";

const MyCustomNode = ({ data }) => (
    <div className="bg-card rounded-md border p-3">
        <TypedHandle id="in" portType="number" type="target" position={Position.Left} />
        <strong>{data.label}</strong>
        <TypedHandle id="out" portType="number" type="source" position={Position.Right} />
    </div>
);

// Pass custom renderers via nodeTypes (the built-in "typed" renderer is
// always registered).
<NodeEditor nodes={nodes} edges={edges} nodeTypes={{ custom: MyCustomNode }} />`;

const PROPS: PropRow[] = [
    { name: `nodes`, type: `ReadonlyArray<Node>`, default: `—`, description: `Required. ReactFlow node array.` },
    { name: `edges`, type: `ReadonlyArray<Edge>`, default: `—`, description: `Required. ReactFlow edge array.` },
    { name: `onNodesChange`, type: `OnNodesChange`, default: `—`, description: `Standard ReactFlow change handler. Pair with applyNodeChanges from @xyflow/react.` },
    { name: `onEdgesChange`, type: `OnEdgesChange`, default: `—`, description: `Standard ReactFlow change handler. Pair with applyEdgeChanges from @xyflow/react.` },
    { name: `onConnect`, type: `OnConnect`, default: `—`, description: `Fires when the user drops a connection on a valid target. Use addEdge to append it.` },
    { name: `nodeTypes`, type: `Record<string, ComponentType<NodeProps>>`, default: `{ typed: TypedNode }`, description: `Custom node renderers, keyed by node.type. The built-in "typed" renderer is always available.` },
    { name: `fitView`, type: `boolean`, default: `true`, description: `Fit the viewport to the graph once on mount.` },
    { name: `showBackground`, type: `boolean`, default: `true`, description: `Mount the dotted background pattern.` },
    { name: `showControls`, type: `boolean`, default: `true`, description: `Mount the zoom / fit / lock control buttons.` },
    { name: `showMiniMap`, type: `boolean`, default: `false`, description: `Mount the minimap in the bottom-right corner.` },
    { name: `isValidConnection`, type: `(connection) => boolean`, default: `—`, description: `Extra connection-validity check applied AFTER port-type matching (e.g. cycle detection).` },
    { name: `onInit`, type: `(instance: ReactFlowInstance) => void`, default: `—`, description: `Invoked once the underlying ReactFlow instance is ready.` },
    { name: `className`, type: `string`, default: `—`, description: `Extra classes on the outer wrapper.` },
    { name: `style`, type: `CSSProperties`, default: `—`, description: `Inline style on the outer wrapper.` }
];

const TYPED_HANDLE_PROPS: PropRow[] = [
    { name: `id`, type: `string`, default: `—`, description: `Required. Distinguishes multiple handles on the same node.` },
    { name: `portType`, type: `string`, default: `—`, description: `Required. Strict-equality port type identifier. Connections are only allowed between handles whose portTypes are equal.` },
    { name: `type`, type: `"source" | "target"`, default: `—`, description: `Forwarded to ReactFlow's <Handle>. Source = output, target = input.` },
    { name: `position`, type: `Position`, default: `—`, description: `Forwarded to ReactFlow's <Handle>. Which edge of the node the handle sits on.` }
];

const TYPED_NODE_DATA_PROPS: PropRow[] = [
    { name: `label`, type: `string`, default: `—`, description: `Header text shown at the top of the node.` },
    { name: `inputs`, type: `ReadonlyArray<PortDefinition>`, default: `[]`, description: `Input ports. Rendered as TypedHandles on the left edge.` },
    { name: `outputs`, type: `ReadonlyArray<PortDefinition>`, default: `[]`, description: `Output ports. Rendered as TypedHandles on the right edge.` },
    { name: `body`, type: `ReactNode`, default: `—`, description: `Free-form React content rendered inside the node body. Use this to embed intermediary results, controls, or any other component.` }
];

const useDocStrings = () => {
    const mowsContext = React.useContext(MowsContext);
    if (!mowsContext) {
        throw new Error(`<NodeEditorDocPage> must be rendered inside <MowsProvider>`);
    }
    return mowsContext.t.example.examples.nodeEditor;
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
        { id: ANCHOR.apiReference, label: doc.apiReference.title }
    ];
};

const VALIDATOR_TEST_FILE = `lib/components/editor/nodeEditor/typedValidator.test.ts`;
const SHIM_TEST_FILE = `lib/components/editor/nodeEditor/NodeEditor.test.tsx`;

const buildBehaviourEntries = (
    statements: Strings[`doc`][`definedBehaviour`][`statements`]
): BehaviourEntry[] => [
    {
        statement: statements.acceptsMatchingTypes,
        testFile: VALIDATOR_TEST_FILE,
        testName: `accepts a connection between two TypedHandles with matching types`,
        testLine: 17
    },
    {
        statement: statements.rejectsMismatchedTypes,
        testFile: VALIDATOR_TEST_FILE,
        testName: `rejects a connection between two TypedHandles with mismatched types`,
        testLine: 24
    },
    {
        statement: statements.rejectsMixedTypedUntyped,
        testFile: VALIDATOR_TEST_FILE,
        testName: `rejects a connection when only the source is typed (mixing typed/untyped)`,
        testLine: 31
    },
    {
        statement: statements.allowsTwoUntyped,
        testFile: VALIDATOR_TEST_FILE,
        testName: `accepts a connection between two untyped handles`,
        testLine: 41
    },
    {
        statement: statements.rejectsIncompleteDrag,
        testFile: VALIDATOR_TEST_FILE,
        testName: `rejects connections where any field is null (incomplete drag)`,
        testLine: 46
    },
    {
        statement: statements.extraAfterTyped,
        testFile: VALIDATOR_TEST_FILE,
        testName: `runs the extra predicate only after the typed check passes`,
        testLine: 64
    },
    {
        statement: statements.lazyChunk,
        testFile: SHIM_TEST_FILE,
        testName: `renders the lazy-loaded implementation`,
        testLine: 18
    }
];

export const NodeEditorDocPage = () => {
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
                            example={nodeEditorExampleById(`default`)}
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
                    <PropTable heading={`<NodeEditor>`} rows={PROPS} />
                    <PropTable heading={`<TypedHandle>`} rows={TYPED_HANDLE_PROPS} />
                    <PropTable heading={`TypedNodeData`} rows={TYPED_NODE_DATA_PROPS} />
                </div>
            </DocSection>
        </DocPage>
    );
};

export default NodeEditorDocPage;
