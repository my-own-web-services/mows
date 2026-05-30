import { describe, expect, it } from "vitest";
import {
    createAppSettingsContextValue,
    defineAppSettings,
    matchesFieldType,
    type SelectField
} from "./appSettings";
import {
    SettingsManager,
    type SettingsStorageAdapter
} from "./SettingsManager";

const inMemoryStorage = (): SettingsStorageAdapter => {
    const data = new Map<string, string>();
    return {
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => {
            data.set(key, value);
        },
        removeItem: (key) => {
            data.delete(key);
        }
    };
};

describe(`defineAppSettings`, () => {
    it(`throws on an empty appKey to prevent silent writes`, () => {
        expect(() => defineAppSettings({ appKey: ``, schema: {} })).toThrow();
    });

    it(`returns the schema verbatim under the given appKey`, () => {
        const schema = {
            defaultView: {
                type: `select`,
                options: [
                    { value: `grid`, label: `Grid` },
                    { value: `list`, label: `List` }
                ],
                default: `grid`,
                label: `Default view`
            } as const satisfies SelectField,
            showHidden: {
                type: `boolean` as const,
                default: false,
                label: `Show hidden`
            }
        };
        const out = defineAppSettings({ appKey: `filez`, schema });
        expect(out.appKey).toBe(`filez`);
        expect(out.schema).toBe(schema);
    });
});

describe(`matchesFieldType`, () => {
    it(`accepts matching primitives, rejects everything else`, () => {
        expect(matchesFieldType(true, { type: `boolean`, default: false, label: `x` })).toBe(true);
        expect(matchesFieldType(`yes`, { type: `boolean`, default: false, label: `x` })).toBe(false);

        expect(matchesFieldType(7, { type: `number`, default: 0, label: `x` })).toBe(true);
        expect(matchesFieldType(NaN, { type: `number`, default: 0, label: `x` })).toBe(false);
        expect(matchesFieldType(`7`, { type: `number`, default: 0, label: `x` })).toBe(false);

        expect(matchesFieldType(`hello`, { type: `string`, default: ``, label: `x` })).toBe(true);
        expect(matchesFieldType(42, { type: `string`, default: ``, label: `x` })).toBe(false);

        expect(matchesFieldType(`#abcdef`, { type: `color`, default: `#000000`, label: `x` })).toBe(true);
    });

    it(`select only accepts declared option values`, () => {
        const field: SelectField = {
            type: `select`,
            options: [
                { value: `a`, label: `A` },
                { value: `b`, label: `B` }
            ],
            default: `a`,
            label: `x`
        };
        expect(matchesFieldType(`a`, field)).toBe(true);
        expect(matchesFieldType(`b`, field)).toBe(true);
        expect(matchesFieldType(`c`, field)).toBe(false);
    });
});

describe(`createAppSettingsContextValue`, () => {
    it(`reads / writes against the manager under the registered appKey`, () => {
        const manager = new SettingsManager({
            storagePrefix: `mows`,
            storage: inMemoryStorage()
        });
        const schema = defineAppSettings({
            appKey: `filez`,
            schema: {
                showHidden: { type: `boolean`, default: false, label: `Show hidden` }
            }
        });
        const ctx = createAppSettingsContextValue(manager, schema);

        expect(ctx.registered).toBe(schema);
        expect(ctx.getValue(`showHidden`)).toBeUndefined();

        ctx.setValue(`showHidden`, true);
        expect(ctx.getValue(`showHidden`)).toBe(true);
        // And the write landed in the right slot of the unified blob.
        expect(manager.getApp(`filez`, `showHidden`)).toBe(true);
    });

    it(`throws on writes when no schema is registered (catches wiring bugs)`, () => {
        const manager = new SettingsManager({
            storagePrefix: `mows`,
            storage: inMemoryStorage()
        });
        const ctx = createAppSettingsContextValue(manager, null);
        expect(ctx.registered).toBeNull();
        // Reads return undefined (callers should never reach here in
        // production — useAppSetting throws on unregistered schemas).
        expect(ctx.getValue(`anything`)).toBeUndefined();
        // Writes fail loud — the "forgot to pass appSettings to
        // MowsProvider" bug surface should not silently land data in a
        // hidden sentinel bucket.
        expect(() => ctx.setValue(`anything`, 1)).toThrow(
            /no app schema was registered/i
        );
    });

    it(`subscribes to the correct manager path`, () => {
        const manager = new SettingsManager({
            storagePrefix: `mows`,
            storage: inMemoryStorage()
        });
        const schema = defineAppSettings({
            appKey: `filez`,
            schema: {
                view: {
                    type: `select`,
                    options: [
                        { value: `grid`, label: `Grid` },
                        { value: `list`, label: `List` }
                    ],
                    default: `grid`,
                    label: `View`
                }
            }
        });
        const ctx = createAppSettingsContextValue(manager, schema);

        let count = 0;
        ctx.subscribe(`view`, () => {
            count++;
        });
        ctx.setValue(`view`, `list`);
        expect(count).toBe(1);
        // Writing a different field on the same app must not fire this
        // listener (path-specific subscription).
        ctx.setValue(`other`, 1);
        expect(count).toBe(1);
    });
});
