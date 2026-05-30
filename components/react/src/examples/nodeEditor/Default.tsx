import {
    addEdge,
    applyEdgeChanges,
    applyNodeChanges,
    type Edge,
    type Node as RFNode
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import NodeEditor from "../../../lib/components/editor/nodeEditor/NodeEditor";
import type { TypedNodeData } from "../../../lib/components/editor/nodeEditor/types";
import { Input } from "../../../lib/components/ui/input";
import { Slider } from "../../../lib/components/ui/slider";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const NODE_IDS = {
    slider: `slider`,
    text: `text`,
    doubler: `doubler`,
    output: `output`
} as const;

type TypedRFNode = RFNode<TypedNodeData, `typed`>;

// Initial node-box hints. xyflow's `fitView` reads these before its
// `ResizeObserver` has had a chance to measure the actual DOM box, and
// when the editor lives behind a `React.lazy` boundary the observer
// sometimes never fires — see `NodeMeasurementGuard` in
// `lib/components/editor/nodeEditor/NodeEditorImpl.tsx`. Carrying these
// declarative dimensions on each node is a strictly safer fallback.
const NODE_WIDTH = 200;
const NODE_HEIGHT = 120;

const Example = () => {
    const [sliderValue, setSliderValue] = useState(7);
    const [textValue, setTextValue] = useState(`hello`);
    const [edges, setEdges] = useState<Edge[]>([
        {
            // Namespaced id so an `onConnect`-produced edge can never
            // collide with this initial wiring.
            id: `initial-slider-doubler`,
            source: NODE_IDS.slider,
            sourceHandle: `out`,
            target: NODE_IDS.doubler,
            targetHandle: `in`
        }
    ]);

    // Nodes live in state, not in a `useMemo`. xyflow's `adoptUserNodes`
    // resets each node's `measured` + `handleBounds` whenever the
    // user-node object reference changes, which flips `nodesInitialized`
    // to false and makes `getEdgePosition` return `null` for every edge
    // — i.e. the edge layer renders nothing until the ResizeObserver
    // re-measures. Recomputing the whole `nodes` array from a `useMemo`
    // on every render (e.g. on every slider tick) therefore made every
    // edge visibly blink out. Keeping nodes in state and only patching
    // the specific node whose body changed lets the unchanged nodes
    // keep their measured cache, and the patched node's spread carries
    // `measured` forward from the previous render so its handle bounds
    // survive too.
    const [nodes, setNodes] = useState<TypedRFNode[]>(() => [
        {
            id: NODE_IDS.slider,
            type: `typed`,
            position: { x: 0, y: 0 },
            width: NODE_WIDTH,
            height: NODE_HEIGHT,
            data: {
                label: `Slider`,
                outputs: [{ id: `out`, type: `number`, label: `value: number` }],
                body: null
            }
        },
        {
            id: NODE_IDS.text,
            type: `typed`,
            position: { x: 0, y: 220 },
            width: NODE_WIDTH,
            height: NODE_HEIGHT,
            data: {
                label: `Text`,
                outputs: [{ id: `out`, type: `string`, label: `text: string` }],
                body: null
            }
        },
        {
            id: NODE_IDS.doubler,
            type: `typed`,
            position: { x: 320, y: 60 },
            width: NODE_WIDTH,
            height: NODE_HEIGHT,
            data: {
                label: `Doubler`,
                inputs: [{ id: `in`, type: `number`, label: `in: number` }],
                outputs: [{ id: `out`, type: `number`, label: `2×in: number` }],
                body: null
            }
        },
        {
            id: NODE_IDS.output,
            type: `typed`,
            position: { x: 640, y: 60 },
            width: NODE_WIDTH,
            height: NODE_HEIGHT,
            data: {
                label: `Output`,
                inputs: [{ id: `in`, type: `number`, label: `value: number` }],
                body: null
            }
        }
    ]);

    // Trivial data-flow: when a typed edge connects two nodes, the downstream
    // node receives its upstream value. Real applications would drive this off
    // a topological sort; for the demo a hand-written lookup is enough.
    const isConnected = useCallback(
        (source: string, target: string): boolean =>
            edges.some((e) => e.source === source && e.target === target),
        [edges]
    );
    const doublerInput = isConnected(NODE_IDS.slider, NODE_IDS.doubler)
        ? sliderValue
        : undefined;
    const doublerOutput = doublerInput === undefined ? undefined : doublerInput * 2;
    const outputValue = isConnected(NODE_IDS.doubler, NODE_IDS.output)
        ? doublerOutput
        : undefined;

    useExampleState({
        sliderValue,
        textValue,
        edges: edges.map((e) => `${e.source}→${e.target}`),
        outputValue: outputValue ?? null
    });

    // One body per node, memoised on the inputs that drive its content.
    // Identity-stable bodies are how the patch below keeps the unchanged
    // nodes' object references constant across renders.
    const sliderBody = useMemo<ReactNode>(
        () => (
            <div className={`flex flex-col gap-2`}>
                <Slider
                    value={[sliderValue]}
                    onValueChange={(v) => setSliderValue(v[0] ?? 0)}
                    min={0}
                    max={100}
                    step={1}
                    className={`min-w-[160px]`}
                />
                <span className={`text-muted-foreground text-xs`}>
                    value = {sliderValue}
                </span>
            </div>
        ),
        [sliderValue]
    );
    const textBody = useMemo<ReactNode>(
        () => (
            <Input
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                placeholder={`type here`}
                className={`h-7 min-w-[160px] text-xs`}
            />
        ),
        [textValue]
    );
    const doublerBody = useMemo<ReactNode>(
        () => (
            <span className={`text-muted-foreground text-xs`}>
                {doublerOutput === undefined
                    ? `(not connected)`
                    : `2 × ${doublerInput} = ${doublerOutput}`}
            </span>
        ),
        [doublerInput, doublerOutput]
    );
    const outputBody = useMemo<ReactNode>(
        () => (
            <span className={`text-foreground font-mono text-base`}>
                {outputValue ?? `—`}
            </span>
        ),
        [outputValue]
    );

    // Patch only the nodes whose body actually changed. Returning the
    // same `n` reference for unchanged nodes is load-bearing — see the
    // `useState` comment above.
    useEffect(() => {
        const bodies: Record<string, ReactNode> = {
            [NODE_IDS.slider]: sliderBody,
            [NODE_IDS.text]: textBody,
            [NODE_IDS.doubler]: doublerBody,
            [NODE_IDS.output]: outputBody
        };
        setNodes((current) => {
            let mutated = false;
            const next = current.map((n) => {
                const nextBody = bodies[n.id];
                if (nextBody === undefined || n.data.body === nextBody) return n;
                mutated = true;
                return { ...n, data: { ...n.data, body: nextBody } };
            });
            return mutated ? next : current;
        });
    }, [sliderBody, textBody, doublerBody, outputBody]);

    const handleNodesChange = useCallback(
        (changes: Parameters<typeof applyNodeChanges>[0]) =>
            // `applyNodeChanges` persists `measured` from xyflow's
            // `dimensions` events into our state, so subsequent body
            // patches can carry it forward via `...n`.
            setNodes((current) => applyNodeChanges(changes, current) as TypedRFNode[]),
        []
    );
    const handleEdgesChange = useCallback(
        (changes: Parameters<typeof applyEdgeChanges>[0]) =>
            setEdges((current) => applyEdgeChanges(changes, current)),
        []
    );
    const handleConnect = useCallback(
        (connection: Parameters<typeof addEdge>[0]) =>
            setEdges((current) => addEdge(connection, current)),
        []
    );

    return (
        <div className={`h-[480px] w-full overflow-hidden rounded-md border`}>
            <NodeEditor
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={handleConnect}
                proOptions={{ hideAttribution: true }}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.nodeEditor.default,
    Example
};

export default module;
