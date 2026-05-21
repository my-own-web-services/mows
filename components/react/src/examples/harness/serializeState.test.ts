import { describe, expect, it } from "vitest";
import { serializeState } from "./serializeState";

describe(`serializeState`, () => {
    it(`pretty-prints plain JSON state with 2-space indent`, () => {
        const out = serializeState({ a: 1, b: `hi` });
        expect(out).toBe(`{\n  "a": 1,\n  "b": "hi"\n}`);
    });

    it(`returns "null" for null and undefined`, () => {
        expect(serializeState(null)).toBe(`null`);
        expect(serializeState(undefined)).toBe(`null`);
    });

    it(`replaces functions with a labelled placeholder`, () => {
        const out = serializeState({ onClick: function handler() {} });
        expect(out).toContain(`"[Function handler]"`);
    });

    it(`replaces anonymous functions with [Function]`, () => {
        const out = serializeState({ cb: () => undefined });
        expect(out).toMatch(/\[Function( cb)?\]/);
    });

    it(`replaces circular references with [Circular]`, () => {
        const a: Record<string, unknown> = { name: `a` };
        a.self = a;
        const out = serializeState(a);
        expect(out).toContain(`"[Circular]"`);
    });

    it(`serializes Date as ISO string`, () => {
        const d = new Date(`2026-01-01T00:00:00.000Z`);
        expect(serializeState({ d })).toContain(`"2026-01-01T00:00:00.000Z"`);
    });

    it(`serializes Error with name + message`, () => {
        const out = serializeState({ err: new TypeError(`boom`) });
        expect(out).toContain(`"[TypeError: boom]"`);
    });

    it(`serializes DOM elements by tag name`, () => {
        const el = document.createElement(`div`);
        expect(serializeState({ el })).toContain(`"[Element <div>]"`);
    });

    it(`handles symbols and bigints`, () => {
        const out = serializeState({ s: Symbol(`x`), n: 9007199254740993n });
        expect(out).toContain(`"Symbol(x)"`);
        expect(out).toContain(`"9007199254740993n"`);
    });
});
