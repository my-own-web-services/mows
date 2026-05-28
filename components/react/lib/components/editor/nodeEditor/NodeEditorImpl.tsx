import {
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    ReactFlow,
    ReactFlowProvider,
    useStore,
    useStoreApi,
    useUpdateNodeInternals,
    type NodeProps,
    type ReactFlowInstance
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    type ComponentType,
    type CSSProperties,
    type FC
} from "react";
import { cn } from "@/lib/utils";
import { PortRegistryContext } from "./PortRegistry";
import TypedNode from "./TypedNode";
import { buildTypedValidator } from "./typedValidator";
import type { NodeEditorProps, PortType } from "./types";

const DEFAULT_NODE_TYPES: Record<string, ComponentType<NodeProps>> = {
    typed: TypedNode as ComponentType<NodeProps>
};

// CSS custom properties aren't part of React's `CSSProperties` index
// signature; intersecting with this lets us declare the xyflow theme
// overrides without per-key `as never` casts that bypass the type system.
type CssCustomProperties = {
    readonly [key: `--${string}`]: string | number;
};

// Override xyflow's default stroke colours — its dark-mode `#3e3e3e` is
// near-invisible against the canvas background. Map everything to the
// lib's semantic foreground tokens so edges + the in-flight connection
// line stay legible in both themes. The overrides must land on the
// `.react-flow` element itself because xyflow's own dark-mode rules
// (`.react-flow.dark`) outrank a parent's inline style. Hoisted to
// module scope so the object identity is stable across renders.
const REACT_FLOW_STYLE: CSSProperties & CssCustomProperties = {
    "--xy-edge-stroke-default": `currentColor`,
    "--xy-edge-stroke-width-default": `1.5`,
    "--xy-edge-stroke-selected-default": `var(--primary)`,
    "--xy-connectionline-stroke-default": `currentColor`,
    "--xy-connectionline-stroke-width-default": `2`,
    "--xy-handle-background-color-default": `var(--primary)`,
    "--xy-handle-border-color-default": `var(--background)`
};

type NodeMeasurement = { readonly width: number; readonly height: number };

// Walks the rendered DOM under `container` and returns one entry per
// xyflow node that has non-zero `offsetWidth`/`offsetHeight`. Skipping
// zero-sized entries is important: a node is briefly rendered with no
// layout before the browser paints its content.
const collectNodeMeasurementsFromDom = (
    container: Element
): Map<string, NodeMeasurement> => {
    const measurements = new Map<string, NodeMeasurement>();
    const nodeElements = container.querySelectorAll<HTMLElement>(
        `.react-flow__node[data-id]`
    );
    nodeElements.forEach((nodeElement) => {
        const nodeId = nodeElement.getAttribute(`data-id`);
        if (!nodeId) return;
        const width = nodeElement.offsetWidth;
        const height = nodeElement.offsetHeight;
        if (width === 0 || height === 0) return;
        measurements.set(nodeId, { width, height });
    });
    return measurements;
};

/**
 * Force xyflow to (re)measure every node after mount.
 *
 * When `<NodeEditor>` lives behind a `React.lazy` boundary, xyflow's
 * internal `ResizeObserver` sometimes never fires its initial callback,
 * so `nodesInitialized` stays `false`, `measured.{width,height}` is
 * empty, handle bounds are uncomputed, and the edge layer renders
 * nothing because it cannot resolve edge endpoint geometry.
 *
 * One frame after mount, we walk the rendered DOM, write any missing
 * dimensions into the store via the updater form of `setNodes` (so we
 * never stomp a value xyflow already wrote), and then call
 * `updateNodeInternals` to refresh the handle-bounds cache. The guard
 * only ever runs once per editor lifetime — a ref short-circuits
 * subsequent effect firings, and we further bail out as soon as
 * `nodesInitialized` flips to `true`.
 *
 * As a belt-and-braces fallback, the example also declares explicit
 * `width`/`height` on each node so xyflow can fit the viewport
 * regardless of whether this guard ever runs.
 */
const NodeMeasurementGuard: FC = () => {
    const updateNodeInternals = useUpdateNodeInternals();
    const storeApi = useStoreApi();
    const nodesInitialized = useStore((state) => state.nodesInitialized);
    const domNode = useStore((state) => state.domNode);
    const hasGuardRunRef = useRef(false);

    useEffect(() => {
        if (nodesInitialized || !domNode || hasGuardRunRef.current) return;
        // Defer one frame so the browser has finished initial layout.
        // Reading `offsetWidth`/`offsetHeight` synchronously during the
        // first effect run returns 0 for nodes whose content hasn't
        // painted yet.
        const frame = requestAnimationFrame(() => {
            const measurements = collectNodeMeasurementsFromDom(domNode);
            if (measurements.size === 0) return;
            // Re-read nodes from the store at write time (instead of
            // snapshotting via a `useStore` selector at effect-setup
            // time) so we never write a stale `nodes` array back over
            // anything xyflow updated between effect set-up and the rAF.
            const { nodes: latestNodes, setNodes } = storeApi.getState();
            const nextNodes = latestNodes.map((node) => {
                const measurement = measurements.get(node.id);
                if (!measurement) return node;
                // Don't overwrite a measurement xyflow has already
                // produced — its ResizeObserver may have fired by the
                // time this frame runs.
                if (
                    node.measured?.width !== undefined &&
                    node.measured?.height !== undefined
                ) {
                    return node;
                }
                return {
                    ...node,
                    measured: measurement,
                    width: measurement.width,
                    height: measurement.height
                };
            });
            hasGuardRunRef.current = true;
            setNodes(nextNodes);
            updateNodeInternals([...measurements.keys()]);
        });
        return () => cancelAnimationFrame(frame);
    }, [nodesInitialized, domNode, storeApi, updateNodeInternals]);

    return null;
};

const InnerNodeEditor: FC<NodeEditorProps> = ({
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    nodeTypes,
    className,
    style,
    fitView = true,
    showBackground = true,
    showControls = true,
    showMiniMap = false,
    backgroundVariant = BackgroundVariant.Dots,
    isValidConnection,
    onInit,
    proOptions
}) => {
    const registryRef = useRef<Map<string, PortType>>(new Map());

    const mergedNodeTypes = useMemo(
        () => ({ ...DEFAULT_NODE_TYPES, ...nodeTypes }),
        [nodeTypes]
    );

    const validator = useMemo(
        () => buildTypedValidator(registryRef, isValidConnection),
        [isValidConnection]
    );

    const handleInit = useCallback(
        (instance: ReactFlowInstance) => {
            onInit?.(instance);
        },
        [onInit]
    );

    return (
        <PortRegistryContext.Provider value={registryRef}>
            <div
                className={cn(
                    `text-foreground/70 relative h-full min-h-[400px] w-full`,
                    className
                )}
                style={style}
            >
                <ReactFlow
                    nodes={nodes as Parameters<typeof ReactFlow>[0][`nodes`]}
                    edges={edges as Parameters<typeof ReactFlow>[0][`edges`]}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    nodeTypes={mergedNodeTypes}
                    isValidConnection={validator}
                    fitView={fitView}
                    onInit={handleInit}
                    proOptions={proOptions}
                    colorMode={`system`}
                    style={REACT_FLOW_STYLE}
                >
                    {showBackground ? <Background variant={backgroundVariant} /> : null}
                    {showControls ? <Controls /> : null}
                    {showMiniMap ? <MiniMap pannable zoomable /> : null}
                    <NodeMeasurementGuard />
                </ReactFlow>
            </div>
        </PortRegistryContext.Provider>
    );
};

/**
 * Heavy chunk. `NodeEditor` lazy-imports this so `@xyflow/react` only
 * ships in consumers that actually mount a node editor.
 */
const NodeEditorImpl: FC<NodeEditorProps> = (props) => (
    <ReactFlowProvider>
        <InnerNodeEditor {...props} />
    </ReactFlowProvider>
);

export default NodeEditorImpl;
