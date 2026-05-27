import {
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    ReactFlow,
    ReactFlowProvider,
    type NodeProps,
    type ReactFlowInstance
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import * as React from "react";
import { cn } from "@/lib/utils";
import { PortRegistryContext } from "./PortRegistry";
import TypedNode from "./TypedNode";
import { buildTypedValidator } from "./typedValidator";
import type { NodeEditorProps, PortType } from "./types";

const DEFAULT_NODE_TYPES: Record<string, React.ComponentType<NodeProps>> = {
    typed: TypedNode as React.ComponentType<NodeProps>
};

const InnerNodeEditor: React.FC<NodeEditorProps> = ({
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
    const registryRef = React.useRef<Map<string, PortType>>(new Map());

    const mergedNodeTypes = React.useMemo(
        () => ({ ...DEFAULT_NODE_TYPES, ...nodeTypes }),
        [nodeTypes]
    );

    const validator = React.useMemo(
        () => buildTypedValidator(registryRef, isValidConnection),
        [isValidConnection]
    );

    const handleInit = React.useCallback(
        (instance: ReactFlowInstance) => {
            onInit?.(instance);
        },
        [onInit]
    );

    return (
        <PortRegistryContext.Provider value={registryRef}>
            <div
                className={cn(`relative h-full min-h-[400px] w-full`, className)}
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
                >
                    {showBackground ? <Background variant={backgroundVariant} /> : null}
                    {showControls ? <Controls /> : null}
                    {showMiniMap ? <MiniMap pannable zoomable /> : null}
                </ReactFlow>
            </div>
        </PortRegistryContext.Provider>
    );
};

/**
 * Heavy chunk. `NodeEditor` lazy-imports this so `@xyflow/react` only
 * ships in consumers that actually mount a node editor.
 */
const NodeEditorImpl: React.FC<NodeEditorProps> = (props) => (
    <ReactFlowProvider>
        <InnerNodeEditor {...props} />
    </ReactFlowProvider>
);

export default NodeEditorImpl;
