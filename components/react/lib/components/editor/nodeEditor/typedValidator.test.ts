import { describe, expect, it } from "vitest";
import type { PortRegistryRef } from "./PortRegistry";
import { buildTypedValidator, type TypedConnection } from "./typedValidator";

const makeRegistry = (entries: Record<string, string>): PortRegistryRef => ({
    current: new Map(Object.entries(entries))
});

const conn = (
    source: string,
    sourceHandle: string,
    target: string,
    targetHandle: string
): TypedConnection => ({ source, sourceHandle, target, targetHandle });

describe(`typedValidator`, () => {
    it(`accepts a connection between two TypedHandles with matching types`, () => {
        const validator = buildTypedValidator(
            makeRegistry({ "a/out": `number`, "b/in": `number` })
        );
        expect(validator(conn(`a`, `out`, `b`, `in`))).toBe(true);
    });

    it(`rejects a connection between two TypedHandles with mismatched types`, () => {
        const validator = buildTypedValidator(
            makeRegistry({ "a/out": `number`, "b/in": `string` })
        );
        expect(validator(conn(`a`, `out`, `b`, `in`))).toBe(false);
    });

    it(`rejects a connection when only the source is typed (mixing typed/untyped)`, () => {
        const validator = buildTypedValidator(makeRegistry({ "a/out": `number` }));
        expect(validator(conn(`a`, `out`, `b`, `in`))).toBe(false);
    });

    it(`rejects a connection when only the target is typed`, () => {
        const validator = buildTypedValidator(makeRegistry({ "b/in": `number` }));
        expect(validator(conn(`a`, `out`, `b`, `in`))).toBe(false);
    });

    it(`accepts a connection between two untyped handles`, () => {
        const validator = buildTypedValidator(makeRegistry({}));
        expect(validator(conn(`a`, `out`, `b`, `in`))).toBe(true);
    });

    it(`rejects connections where any field is null (incomplete drag)`, () => {
        const validator = buildTypedValidator(
            makeRegistry({ "a/out": `number`, "b/in": `number` })
        );
        expect(
            validator({ source: null, sourceHandle: `out`, target: `b`, targetHandle: `in` })
        ).toBe(false);
        expect(
            validator({ source: `a`, sourceHandle: null, target: `b`, targetHandle: `in` })
        ).toBe(false);
        expect(
            validator({ source: `a`, sourceHandle: `out`, target: null, targetHandle: `in` })
        ).toBe(false);
        expect(
            validator({ source: `a`, sourceHandle: `out`, target: `b`, targetHandle: null })
        ).toBe(false);
    });

    it(`runs the extra predicate only after the typed check passes`, () => {
        let extraCalls = 0;
        const validator = buildTypedValidator(
            makeRegistry({ "a/out": `number`, "b/in": `number` }),
            () => {
                extraCalls += 1;
                return false;
            }
        );
        expect(validator(conn(`a`, `out`, `b`, `in`))).toBe(false);
        expect(extraCalls).toBe(1);
    });

    it(`does not call the extra predicate when the typed check fails`, () => {
        let extraCalls = 0;
        const validator = buildTypedValidator(
            makeRegistry({ "a/out": `number`, "b/in": `string` }),
            () => {
                extraCalls += 1;
                return true;
            }
        );
        expect(validator(conn(`a`, `out`, `b`, `in`))).toBe(false);
        expect(extraCalls).toBe(0);
    });
});
