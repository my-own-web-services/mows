import { Position, type NodeProps } from "@xyflow/react";
import * as React from "react";
import { cn } from "@/lib/utils";
import TypedHandle from "./TypedHandle";
import type { TypedNode as TypedNodeType } from "./types";

/**
 * Default renderer for nodes of `type: "typed"`. Stacks rows top-to-bottom:
 * a header, an inputs section (handles on the left), an optional body
 * (any React content — useful for embedding intermediary results), and an
 * outputs section (handles on the right).
 *
 * Each port row spans the full node width so the absolutely-positioned
 * `<Handle>` lands on the node's outer edge.
 */
const TypedNode: React.FC<NodeProps<TypedNodeType>> = ({ data, selected }) => {
    const inputs = data.inputs ?? [];
    const outputs = data.outputs ?? [];

    return (
        <div
            className={cn(
                `bg-card text-card-foreground min-w-[180px] rounded-md border shadow-sm`,
                selected && `ring-ring/60 ring-2`
            )}
        >
            <header className={`border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide`}>
                {data.label}
            </header>
            {inputs.length > 0 ? (
                <div className={`border-b py-1`}>
                    {inputs.map((port) => (
                        <div
                            key={port.id}
                            className={`relative flex h-6 items-center px-3 text-xs`}
                        >
                            <TypedHandle
                                id={port.id}
                                portType={port.type}
                                type={`target`}
                                position={Position.Left}
                            />
                            <span className={`text-muted-foreground truncate`}>
                                {port.label ?? port.id}
                            </span>
                        </div>
                    ))}
                </div>
            ) : null}
            {data.body !== undefined && data.body !== null ? (
                <div className={`px-3 py-2 text-sm`}>{data.body}</div>
            ) : null}
            {outputs.length > 0 ? (
                <div className={`border-t py-1`}>
                    {outputs.map((port) => (
                        <div
                            key={port.id}
                            className={`relative flex h-6 items-center justify-end px-3 text-xs`}
                        >
                            <span className={`text-muted-foreground truncate`}>
                                {port.label ?? port.id}
                            </span>
                            <TypedHandle
                                id={port.id}
                                portType={port.type}
                                type={`source`}
                                position={Position.Right}
                            />
                        </div>
                    ))}
                </div>
            ) : null}
        </div>
    );
};

export default TypedNode;
