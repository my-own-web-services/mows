import { describe, expect, it } from "vitest";
import { demos, GROUP_ORDER, type DemoGroupKey } from "../../demos";
import enUS from "../../languages/en-US";

/**
 * Regression guard for the silent-drop bug: any DemoGroupKey not
 * present in `GROUP_ORDER` is filtered out of the sidebar AND of the
 * search filter (App.tsx maps over this list). Demos in that group
 * never render and never match a search query — but nothing else
 * breaks at build time, so the only signal is "user can't find the
 * component". The integrity check below pins both halves of the
 * invariant:
 *
 *   1. Every `demo.groupKey` actually appears in `GROUP_ORDER`.
 *   2. Every key on the translation's `sidebar.groups` (the runtime
 *      form of `DemoGroupKey`) appears in `GROUP_ORDER`.
 *
 * Adding a new group means updating the Translation interface, the
 * locale files, and `GROUP_ORDER` — this test fails fast if any of
 * the three falls behind.
 */
describe(`GROUP_ORDER integrity`, () => {
    it(`covers every groupKey referenced by a registered demo`, () => {
        const missing = demos
            .map((d) => d.groupKey)
            .filter((key) => !GROUP_ORDER.includes(key));
        expect(missing).toEqual([]);
    });

    it(`covers every key declared on the en-US sidebar.groups translation`, () => {
        const declared = Object.keys(enUS.example.sidebar.groups) as DemoGroupKey[];
        const missing = declared.filter((key) => !GROUP_ORDER.includes(key));
        expect(missing).toEqual([]);
    });

    it(`contains no stale entries — every GROUP_ORDER key is a known group`, () => {
        const declared = new Set(Object.keys(enUS.example.sidebar.groups));
        const stale = GROUP_ORDER.filter((key) => !declared.has(key));
        expect(stale).toEqual([]);
    });
});
