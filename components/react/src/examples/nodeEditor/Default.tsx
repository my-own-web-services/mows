import {
    addEdge,
    applyEdgeChanges,
    applyNodeChanges,
    type Edge,
    type Node as RFNode
} from "@xyflow/react";
import { useCallback, useMemo, useState } from "react";
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

const Example = () => {
    const [sliderValue, setSliderValue] = useState(7);
    const [textValue, setTextValue] = useState(`hello`);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({
        [NODE_IDS.slider]: { x: 0, y: 0 },
        [NODE_IDS.text]: { x: 0, y: 220 },
        [NODE_IDS.doubler]: { x: 320, y: 60 },
        [NODE_IDS.output]: { x: 640, y: 60 }
    });

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

    // Declare width/height on every node so React Flow can compute the
    // initial viewport without waiting on ResizeObserver — measurement is
    // unreliable when the editor lives behind a React.lazy boundary, and
    // unmeasured nodes stay `visibility: hidden`.
    const NODE_W = 220;
    const NODE_H_SLIDER = 140;
    const NODE_H_TEXT = 110;
    const NODE_H_DOUBLER = 130;
    const NODE_H_OUTPUT = 110;

    const nodes = useMemo<TypedRFNode[]>(
        () => [
            {
                id: NODE_IDS.slider,
                type: `typed`,
                position: positions[NODE_IDS.slider]!,
                width: NODE_W,
                height: NODE_H_SLIDER,
                data: {
                    label: `Slider`,
                    outputs: [{ id: `out`, type: `number`, label: `value: number` }],
                    body: (
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
                    )
                }
            },
            {
                id: NODE_IDS.text,
                type: `typed`,
                position: positions[NODE_IDS.text]!,
                width: NODE_W,
                height: NODE_H_TEXT,
                data: {
                    label: `Text`,
                    outputs: [{ id: `out`, type: `string`, label: `text: string` }],
                    body: (
                        <Input
                            value={textValue}
                            onChange={(e) => setTextValue(e.target.value)}
                            placeholder={`type here`}
                            className={`h-7 min-w-[160px] text-xs`}
                        />
                    )
                }
            },
            {
                id: NODE_IDS.doubler,
                type: `typed`,
                position: positions[NODE_IDS.doubler]!,
                width: NODE_W,
                height: NODE_H_DOUBLER,
                data: {
                    label: `Doubler`,
                    inputs: [{ id: `in`, type: `number`, label: `in: number` }],
                    outputs: [{ id: `out`, type: `number`, label: `2×in: number` }],
                    body: (
                        <span className={`text-muted-foreground text-xs`}>
                            {doublerOutput === undefined ? `(not connected)` : `2 × ${doublerInput} = ${doublerOutput}`}
                        </span>
                    )
                }
            },
            {
                id: NODE_IDS.output,
                type: `typed`,
                position: positions[NODE_IDS.output]!,
                width: NODE_W,
                height: NODE_H_OUTPUT,
                data: {
                    label: `Output`,
                    inputs: [{ id: `in`, type: `number`, label: `value: number` }],
                    body: (
                        <span className={`text-foreground font-mono text-base`}>
                            {outputValue ?? `—`}
                        </span>
                    )
                }
            }
        ],
        [positions, sliderValue, textValue, doublerInput, doublerOutput, outputValue]
    );

    const handleNodesChange = useCallback(
        (changes: Parameters<typeof applyNodeChanges>[0]) => {
            const next = applyNodeChanges(changes, nodes);
            setPositions(
                Object.fromEntries(next.map((n) => [n.id, { x: n.position.x, y: n.position.y }]))
            );
        },
        [nodes]
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
