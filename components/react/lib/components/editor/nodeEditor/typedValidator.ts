import { portRegistryKey, type PortRegistryRef } from "./PortRegistry";
import type { PortType } from "./types";

export interface TypedConnection {
    readonly source: string | null;
    readonly target: string | null;
    readonly sourceHandle: string | null;
    readonly targetHandle: string | null;
}

/**
 * Strict-equality port-type validator.
 *
 * - If either side is registered as a `TypedHandle`, both sides must be
 *   registered and their `portType`s must be strictly equal.
 * - If neither side is registered, the connection is allowed (the caller
 *   opted out of typing for those handles).
 * - An optional `extra` predicate runs only after port-type checks pass.
 *
 * Any `null` field on the connection (a not-yet-completed drag) rejects.
 */
export const buildTypedValidator = (
    registry: PortRegistryRef,
    extra?: (connection: TypedConnection) => boolean
) => (connection: TypedConnection): boolean => {
    if (
        connection.source === null ||
        connection.target === null ||
        connection.sourceHandle === null ||
        connection.targetHandle === null
    ) {
        return false;
    }
    const sourceType: PortType | undefined = registry.current.get(
        portRegistryKey(connection.source, connection.sourceHandle)
    );
    const targetType: PortType | undefined = registry.current.get(
        portRegistryKey(connection.target, connection.targetHandle)
    );
    const eitherTyped = sourceType !== undefined || targetType !== undefined;
    if (eitherTyped) {
        if (sourceType === undefined || targetType === undefined) return false;
        if (sourceType !== targetType) return false;
    }
    return extra ? extra(connection) : true;
};
