import { createContext } from "react";
import type { PortType } from "./types";

/**
 * Mutable map of `${nodeId}/${handleId}` → declared `PortType`.
 *
 * `TypedHandle` instances register themselves on mount and unregister on
 * unmount; `NodeEditor`'s `isValidConnection` callback reads from the
 * same map. A plain `Map` behind a ref-shaped context is enough — no
 * React state is involved, so registration never triggers re-renders.
 */
export interface PortRegistryRef {
    readonly current: Map<string, PortType>;
}

const buildKey = (nodeId: string, handleId: string): string =>
    `${nodeId}/${handleId}`;

export const portRegistryKey = buildKey;

export const PortRegistryContext = createContext<PortRegistryRef | null>(null);

PortRegistryContext.displayName = `NodeEditorPortRegistry`;
