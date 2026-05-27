import { Handle, useNodeId, type HandleProps } from "@xyflow/react";
import * as React from "react";
import { PortRegistryContext, portRegistryKey } from "./PortRegistry";
import type { PortType } from "./types";

export interface TypedHandleProps extends Omit<HandleProps, `id`> {
    /** Required — distinguishes multiple handles on the same node. */
    readonly id: string;
    /** Strict-equality port type identifier. */
    readonly portType: PortType;
}

/**
 * Drop-in replacement for `<Handle>` that declares a strict-equality
 * port type. Connections are only accepted between two `TypedHandle`s
 * whose `portType` is equal; mixing a typed handle with a bare
 * `<Handle>` is rejected (it's almost always a mistake).
 *
 * Must be rendered inside a custom node passed to `<NodeEditor>` so
 * `useNodeId()` resolves and the registry context is available.
 */
const TypedHandle: React.FC<TypedHandleProps> = ({ id, portType, ...rest }) => {
    const nodeId = useNodeId();
    const registry = React.useContext(PortRegistryContext);

    React.useEffect(() => {
        if (registry === null || nodeId === null) return;
        const key = portRegistryKey(nodeId, id);
        registry.current.set(key, portType);
        return () => {
            registry.current.delete(key);
        };
    }, [registry, nodeId, id, portType]);

    return <Handle id={id} {...rest} data-port-type={portType} />;
};

export default TypedHandle;
