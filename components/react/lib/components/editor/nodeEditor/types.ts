import type { CSSProperties, ReactNode } from "react";
import type {
    Background,
    Connection,
    Edge,
    Node as RFNode,
    NodeProps,
    OnConnect,
    OnEdgesChange,
    OnNodesChange,
    ProOptions,
    ReactFlowInstance
} from "@xyflow/react";

/**
 * A port type is just a string identifier. Connections are only allowed
 * between ports whose `portType` strings compare strictly equal. Encode
 * any subtyping into the string itself (e.g. `"number"`, `"vec3"`,
 * `"image/rgba"`).
 */
export type PortType = string;

export interface PortDefinition {
    readonly id: string;
    readonly type: PortType;
    readonly label?: string;
}

/**
 * Data shape consumed by the built-in `TypedNode` renderer. Custom node
 * renderers can ignore this and use `TypedHandle` directly instead.
 */
export interface TypedNodeData extends Record<string, unknown> {
    readonly label: string;
    readonly inputs?: ReadonlyArray<PortDefinition>;
    readonly outputs?: ReadonlyArray<PortDefinition>;
    /**
     * Free-form React content rendered inside the node body. Use this to
     * embed intermediary results, controls, or any other component.
     */
    readonly body?: ReactNode;
}

export type TypedNode = RFNode<TypedNodeData, `typed`>;

export interface NodeEditorProps {
    readonly nodes: ReadonlyArray<RFNode>;
    readonly edges: ReadonlyArray<Edge>;
    readonly onNodesChange?: OnNodesChange;
    readonly onEdgesChange?: OnEdgesChange;
    readonly onConnect?: OnConnect;
    /**
     * Custom node renderers, keyed by the node's `type`. The built-in
     * `"typed"` renderer is always registered and renders `TypedNodeData`.
     */
    readonly nodeTypes?: Record<string, React.ComponentType<NodeProps>>;
    readonly className?: string;
    readonly style?: CSSProperties;
    /** Fit the viewport to the graph once on mount. Default: `true`. */
    readonly fitView?: boolean;
    /** Mount the dotted background pattern. Default: `true`. */
    readonly showBackground?: boolean;
    /** Mount the zoom / fit / lock controls in the bottom-left. Default: `true`. */
    readonly showControls?: boolean;
    /** Mount the minimap in the bottom-right. Default: `false`. */
    readonly showMiniMap?: boolean;
    /** Background pattern variant. Default: `"dots"`. */
    readonly backgroundVariant?: React.ComponentProps<typeof Background>[`variant`];
    /**
     * Extra connection-validity check applied AFTER port-type matching.
     * Use this to enforce graph-level rules (no cycles, max-fan-in, etc.).
     */
    readonly isValidConnection?: (connection: Connection) => boolean;
    /** Invoked once the underlying `ReactFlow` instance is ready. */
    readonly onInit?: (instance: ReactFlowInstance) => void;
    /** Forwarded to ReactFlow (e.g. `{ hideAttribution: true }`). */
    readonly proOptions?: ProOptions;
}
