import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    SETTINGS_BLOB_VERSION,
    SettingsManager,
    type SettingsBlob,
    type SettingsStorageAdapter,
    emptySettingsBlob
} from "./SettingsManager";

const inMemoryStorage = (): SettingsStorageAdapter & { dump: () => Map<string, string> } => {
    const data = new Map<string, string>();
    return {
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => {
            data.set(key, value);
        },
        removeItem: (key) => {
            data.delete(key);
        },
        dump: () => data
    };
};

describe(`SettingsManager`, () => {
    let storage: ReturnType<typeof inMemoryStorage>;

    beforeEach(() => {
        storage = inMemoryStorage();
    });

    it(`starts from an empty blob when nothing is stored`, () => {
        const manager = new SettingsManager({ storagePrefix: `mows`, storage });
        expect(manager.getBlob()).toEqual(emptySettingsBlob());
    });

    it(`persists core writes to the unified key`, () => {
        const manager = new SettingsManager({ storagePrefix: `mows`, storage });
        manager.setCore(`theme`, `dark`);
        const persisted = JSON.parse(storage.dump().get(`mows_settings`)!) as SettingsBlob;
        expect(persisted._v).toBe(SETTINGS_BLOB_VERSION);
        expect(persisted.core.theme).toBe(`dark`);
    });

    it(`writes app settings under the per-app sub-key`, () => {
        const manager = new SettingsManager({ storagePrefix: `mows`, storage });
        manager.setApp(`filez`, `defaultView`, `grid`);
        manager.setApp(`filez`, `showHidden`, true);
        const persisted = JSON.parse(storage.dump().get(`mows_settings`)!) as SettingsBlob;
        expect(persisted.app).toEqual({ filez: { defaultView: `grid`, showHidden: true } });
    });

    it(`notifies path-specific subscribers when the matching value changes`, () => {
        const manager = new SettingsManager({ storagePrefix: `mows`, storage });
        const themeListener = vi.fn();
        const languageListener = vi.fn();
        manager.subscribe(`core.theme`, themeListener);
        manager.subscribe(`core.language`, languageListener);

        manager.setCore(`theme`, `dark`);

        expect(themeListener).toHaveBeenCalledTimes(1);
        expect(languageListener).toHaveBeenCalledTimes(0);
    });

    it(`notifies ancestor-path subscribers too`, () => {
        const manager = new SettingsManager({ storagePrefix: `mows`, storage });
        const appListener = vi.fn();
        const filezListener = vi.fn();
        const fieldListener = vi.fn();
        manager.subscribe(`app`, appListener);
        manager.subscribe(`app.filez`, filezListener);
        manager.subscribe(`app.filez.defaultView`, fieldListener);

        manager.setApp(`filez`, `defaultView`, `grid`);

        expect(fieldListener).toHaveBeenCalledTimes(1);
        expect(filezListener).toHaveBeenCalledTimes(1);
        expect(appListener).toHaveBeenCalledTimes(1);
    });

    it(`fires wildcard subscribers on every change including replaceBlob`, () => {
        const manager = new SettingsManager({ storagePrefix: `mows`, storage });
        const wildcard = vi.fn();
        manager.subscribe(`*`, wildcard);

        manager.setCore(`theme`, `dark`);
        expect(wildcard).toHaveBeenCalledTimes(1);

        manager.setApp(`filez`, `defaultView`, `grid`);
        expect(wildcard).toHaveBeenCalledTimes(2);

        manager.replaceBlob({
            _v: SETTINGS_BLOB_VERSION,
            core: { theme: `light` },
            app: {}
        });
        // replaceBlob calls notifyAll which fires every listener once,
        // including the wildcard bucket.
        expect(wildcard).toHaveBeenCalledTimes(3);
    });

    it(`unsubscribe stops further notifications`, () => {
        const manager = new SettingsManager({ storagePrefix: `mows`, storage });
        const listener = vi.fn();
        const unsubscribe = manager.subscribe(`core.theme`, listener);

        manager.setCore(`theme`, `dark`);
        expect(listener).toHaveBeenCalledTimes(1);

        unsubscribe();
        manager.setCore(`theme`, `light`);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it(`skips notify when the value didn't actually change (referential equality)`, () => {
        const manager = new SettingsManager({ storagePrefix: `mows`, storage });
        const listener = vi.fn();
        manager.setCore(`theme`, `dark`);
        manager.subscribe(`core.theme`, listener);

        manager.setCore(`theme`, `dark`);
        expect(listener).toHaveBeenCalledTimes(0);
    });

    it(`falls back to an empty blob when stored JSON is corrupted`, () => {
        storage.setItem(`mows_settings`, `not-valid-json`);
        const manager = new SettingsManager({ storagePrefix: `mows`, storage });
        expect(manager.getBlob()).toEqual(emptySettingsBlob());
    });

    it(`re-hydrates correctly across instances`, () => {
        const first = new SettingsManager({ storagePrefix: `mows`, storage });
        first.setCore(`theme`, `dark`);
        first.setApp(`filez`, `defaultView`, `grid`);

        const second = new SettingsManager({ storagePrefix: `mows`, storage });
        expect(second.getCore(`theme`)).toBe(`dark`);
        expect(second.getApp(`filez`, `defaultView`)).toBe(`grid`);
    });

    it(`seeds the blob from an initialBlob when provided and immediately persists it`, () => {
        const seed: SettingsBlob = {
            _v: SETTINGS_BLOB_VERSION,
            core: { theme: `seeded` },
            device: {},
            app: { example: { foo: `bar` } }
        };
        const manager = new SettingsManager({
            storagePrefix: `mows`,
            storage,
            initialBlob: seed
        });
        expect(manager.getBlob()).toEqual(seed);
        const persisted = JSON.parse(storage.dump().get(`mows_settings`)!);
        expect(persisted).toEqual(seed);
    });

    it(`normaliseBlob drops malformed top-level shapes back to empty`, () => {
        storage.setItem(`mows_settings`, JSON.stringify({ unrelated: true }));
        const manager = new SettingsManager({ storagePrefix: `mows`, storage });
        // `core` and `app` were absent; they should be present as empty
        // objects so callers don't blow up dereferencing them.
        expect(manager.getBlob().core).toEqual({});
        expect(manager.getBlob().app).toEqual({});
        expect(manager.getBlob()._v).toBe(SETTINGS_BLOB_VERSION);
    });

    it(`coreSlotAdapter mirrors get/set on a typed core key`, () => {
        const manager = new SettingsManager({ storagePrefix: `mows`, storage });
        const slot = manager.coreSlotAdapter(`hotkeyConfig`);
        expect(slot.get()).toBeUndefined();
        slot.set({ "core.openSettings": { keyCombinations: [`mod+,`] } });
        expect(slot.get()).toEqual({
            "core.openSettings": { keyCombinations: [`mod+,`] }
        });
        expect(manager.getCore(`hotkeyConfig`)).toEqual({
            "core.openSettings": { keyCombinations: [`mod+,`] }
        });
    });

    it(`subscribing to a path that doesn't exist yet fires on first write`, () => {
        const manager = new SettingsManager({ storagePrefix: `mows`, storage });
        const listener = vi.fn();
        manager.subscribe(`core.theme`, listener);
        // Nothing at `core.theme` yet — subscribing before first write
        // must still register; the listener fires on the eventual set.
        expect(manager.getCore(`theme`)).toBeUndefined();
        manager.setCore(`theme`, `dark`);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it(`identical writes skip persistence AND notification`, () => {
        const manager = new SettingsManager({ storagePrefix: `mows`, storage });
        manager.setCore(`theme`, `dark`);
        const beforeWrites = storage.dump().get(`mows_settings`);
        const listener = vi.fn();
        manager.subscribe(`core.theme`, listener);

        manager.setCore(`theme`, `dark`);
        manager.setCore(`theme`, `dark`);

        expect(listener).toHaveBeenCalledTimes(0);
        // Persist hasn't been called either — the stored string is
        // byte-identical to the snapshot from before the no-op writes.
        expect(storage.dump().get(`mows_settings`)).toBe(beforeWrites);
    });

    it(`a listener that unsubscribes itself mid-notify doesn't skip siblings`, () => {
        const manager = new SettingsManager({ storagePrefix: `mows`, storage });
        const second = vi.fn();
        let unsubscribeFirst: (() => void) | null = null;
        unsubscribeFirst = manager.subscribe(`core.theme`, () => {
            unsubscribeFirst?.();
        });
        manager.subscribe(`core.theme`, second);

        manager.setCore(`theme`, `dark`);

        // Second listener fired even though the first removed itself
        // mid-iteration.
        expect(second).toHaveBeenCalledTimes(1);

        // Subsequent change: only the second listener remains.
        second.mockClear();
        manager.setCore(`theme`, `light`);
        expect(second).toHaveBeenCalledTimes(1);
    });

    it(`a listener that throws doesn't abort the cycle or block persistence`, () => {
        const manager = new SettingsManager({ storagePrefix: `mows`, storage });
        const before = vi.fn();
        const after = vi.fn();
        manager.subscribe(`core.theme`, before);
        manager.subscribe(`core.theme`, () => {
            throw new Error(`boom from listener`);
        });
        manager.subscribe(`core.theme`, after);

        manager.setCore(`theme`, `dark`);

        expect(before).toHaveBeenCalledTimes(1);
        expect(after).toHaveBeenCalledTimes(1);
        // Persist still succeeded — the in-memory blob made it onto
        // storage despite the throwing subscriber.
        const persisted = JSON.parse(storage.dump().get(`mows_settings`)!) as SettingsBlob;
        expect(persisted.core.theme).toBe(`dark`);
    });

    it(`replaceBlob rejects pastes whose _v doesn't match`, () => {
        const manager = new SettingsManager({ storagePrefix: `mows`, storage });
        expect(() =>
            manager.replaceBlob({
                _v: 999 as unknown as 1,
                core: {},
                device: {},
                app: {}
            })
        ).toThrow(/_v/);
    });

    it(`onPersistError fires when storage.setItem throws (quota / private mode)`, () => {
        const failing: SettingsStorageAdapter = {
            getItem: () => null,
            setItem: () => {
                throw new Error(`QuotaExceededError`);
            },
            removeItem: () => undefined
        };
        const onPersistError = vi.fn();
        const manager = new SettingsManager({
            storagePrefix: `mows`,
            storage: failing,
            onPersistError
        });

        manager.setCore(`theme`, `dark`);

        // In-memory blob updated even though persistence failed —
        // dropping the in-memory write would be worse than logging.
        expect(manager.getCore(`theme`)).toBe(`dark`);
        expect(onPersistError).toHaveBeenCalledTimes(1);
        expect((onPersistError.mock.calls[0][0] as Error).message).toMatch(/Quota/);
    });

    it(`replaceBlob accepts a wholesale paste and persists it`, () => {
        const manager = new SettingsManager({ storagePrefix: `mows`, storage });
        manager.replaceBlob({
            _v: SETTINGS_BLOB_VERSION,
            core: { language: `de` },
            device: {},
            app: { app: { x: 1 } }
        });
        expect(manager.getCore(`language`)).toBe(`de`);
        expect(manager.getApp(`app`, `x`)).toBe(1);
        const persisted = JSON.parse(storage.dump().get(`mows_settings`)!);
        expect(persisted.core.language).toBe(`de`);
    });

    it(`storage events from other tabs refresh the blob and notify subscribers`, () => {
        // Two managers backed by the SAME in-memory storage simulate two
        // tabs of the same origin. Writing through manager A doesn't
        // fire a storage event (the browser only fires in *other* tabs),
        // so we synthesise one against `window` and check that manager B
        // re-reads + notifies.
        const managerA = new SettingsManager({ storagePrefix: `mows`, storage });
        const managerB = new SettingsManager({ storagePrefix: `mows`, storage });
        const subscriberB = vi.fn();
        managerB.subscribe(`*`, subscriberB);

        managerA.setCore(`theme`, `dark`);
        // managerB hasn't seen the write yet — its in-memory blob is the
        // pre-event snapshot.
        expect(managerB.getCore(`theme`)).toBeUndefined();

        // Simulate the storage event that the browser would fire in B's
        // tab when A's tab persisted. jsdom doesn't propagate events
        // between SettingsManager instances; we dispatch manually.
        window.dispatchEvent(
            new StorageEvent(`storage`, {
                key: `mows_settings`,
                newValue: storage.dump().get(`mows_settings`) ?? null
            })
        );

        expect(managerB.getCore(`theme`)).toBe(`dark`);
        expect(subscriberB).toHaveBeenCalled();

        managerA.destroy();
        managerB.destroy();
    });

    it(`destroy unsubscribes the storage event listener`, () => {
        const manager = new SettingsManager({ storagePrefix: `mows`, storage });
        const subscriber = vi.fn();
        manager.subscribe(`*`, subscriber);
        manager.destroy();

        // After destroy, a storage event should be ignored.
        storage.setItem(
            `mows_settings`,
            JSON.stringify({ _v: SETTINGS_BLOB_VERSION, core: { theme: `dark` }, device: {}, app: {} })
        );
        window.dispatchEvent(
            new StorageEvent(`storage`, {
                key: `mows_settings`,
                newValue: storage.dump().get(`mows_settings`) ?? null
            })
        );
        expect(subscriber).not.toHaveBeenCalled();
    });

    it(`ignores storage events for other keys`, () => {
        const manager = new SettingsManager({ storagePrefix: `mows`, storage });
        const subscriber = vi.fn();
        manager.subscribe(`*`, subscriber);
        window.dispatchEvent(
            new StorageEvent(`storage`, {
                key: `someone_else_settings`,
                newValue: `{}`
            })
        );
        expect(subscriber).not.toHaveBeenCalled();
        manager.destroy();
    });
});
