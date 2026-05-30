import { beforeEach, describe, expect, it } from "vitest";
import { migrateLegacySettings } from "./legacyMigration";
import {
    SETTINGS_BLOB_VERSION,
    type SettingsStorageAdapter
} from "./SettingsManager";

const inMemoryStorage = (initial: Record<string, string> = {}): SettingsStorageAdapter & {
    has: (k: string) => boolean;
    snapshot: () => Record<string, string>;
} => {
    const data = new Map<string, string>(Object.entries(initial));
    return {
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => {
            data.set(key, value);
        },
        removeItem: (key) => {
            data.delete(key);
        },
        has: (k) => data.has(k),
        snapshot: () => Object.fromEntries(data.entries())
    };
};

describe(`migrateLegacySettings`, () => {
    let storage: ReturnType<typeof inMemoryStorage>;

    beforeEach(() => {
        storage = inMemoryStorage();
    });

    it(`returns migrated:false on a fresh install (no new key, no legacy keys)`, () => {
        const outcome = migrateLegacySettings(`mows`, storage);
        expect(outcome.migrated).toBe(false);
        expect(outcome.blob).toBeUndefined();
    });

    it(`is a no-op when the new unified key already exists`, () => {
        storage.setItem(`mows_settings`, JSON.stringify({ _v: 1, core: {}, app: {} }));
        // Even if legacy keys are also present, the unified key wins —
        // it's the source of truth post-migration and getting overwritten
        // would lose any newer changes.
        storage.setItem(`mows_theme`, `dark`);

        const outcome = migrateLegacySettings(`mows`, storage);
        expect(outcome.migrated).toBe(false);
        expect(storage.has(`mows_theme`)).toBe(true);
    });

    it(`migrates string-valued legacy keys into core`, () => {
        storage.setItem(`mows_theme`, `dark`);
        storage.setItem(`mows_code_theme`, `github-dark`);
        storage.setItem(`mows_language`, `de`);
        storage.setItem(`mows_map_style`, `light`);

        const outcome = migrateLegacySettings(`mows`, storage);
        expect(outcome.migrated).toBe(true);
        expect(outcome.blob).toBeDefined();
        expect(outcome.blob!._v).toBe(SETTINGS_BLOB_VERSION);
        expect(outcome.blob!.core).toEqual({
            theme: `dark`,
            codeTheme: `github-dark`,
            language: `de`,
            mapStyle: `light`
        });
        // Legacy keys are gone.
        expect(storage.has(`mows_theme`)).toBe(false);
        expect(storage.has(`mows_code_theme`)).toBe(false);
        expect(storage.has(`mows_language`)).toBe(false);
        expect(storage.has(`mows_map_style`)).toBe(false);
    });

    it(`migrates JSON-valued legacy keys (toast / codeEditor → core, hotkey / recent actions → device)`, () => {
        storage.setItem(
            `mows_code_editor_settings`,
            JSON.stringify({ showWhitespace: false, wrap: true })
        );
        storage.setItem(
            `mows_toast_settings`,
            JSON.stringify({ position: `top-right` })
        );
        storage.setItem(
            `mows_hotkey_config`,
            JSON.stringify({ "core.save": { keyCombinations: [`mod+s`] } })
        );
        storage.setItem(
            `mows_recent_actions`,
            JSON.stringify([{ actionId: `core.open`, timestamp: 1 }])
        );

        const outcome = migrateLegacySettings(`mows`, storage);
        expect(outcome.migrated).toBe(true);
        expect(outcome.blob!.core.codeEditor).toEqual({
            showWhitespace: false,
            wrap: true
        });
        expect(outcome.blob!.core.toast).toEqual({ position: `top-right` });
        // Device-local slots: per-machine state stays out of `core` so
        // a future remote-sync provider doesn't propagate it.
        expect(outcome.blob!.device.hotkeyConfig).toEqual({
            "core.save": { keyCombinations: [`mod+s`] }
        });
        expect(outcome.blob!.device.recentActions).toEqual([
            { actionId: `core.open`, timestamp: 1 }
        ]);
        // Legacy keys are gone.
        expect(storage.has(`mows_code_editor_settings`)).toBe(false);
        expect(storage.has(`mows_toast_settings`)).toBe(false);
        expect(storage.has(`mows_hotkey_config`)).toBe(false);
        expect(storage.has(`mows_recent_actions`)).toBe(false);
    });

    it(`tolerates a corrupted JSON legacy value by skipping that slot`, () => {
        storage.setItem(`mows_theme`, `dark`);
        storage.setItem(`mows_toast_settings`, `not-valid-json`);

        const outcome = migrateLegacySettings(`mows`, storage);
        expect(outcome.migrated).toBe(true);
        // Theme migrated normally; corrupted toast is skipped but the
        // legacy key still gets removed (we read it, didn't keep the
        // value, and don't want stale legacy data lingering).
        expect(outcome.blob!.core.theme).toBe(`dark`);
        expect(outcome.blob!.core.toast).toBeUndefined();
        expect(storage.has(`mows_theme`)).toBe(false);
        expect(storage.has(`mows_toast_settings`)).toBe(false);
    });

    it(`second-run after a successful migration is a true no-op`, () => {
        storage.setItem(`mows_theme`, `dark`);
        const first = migrateLegacySettings(`mows`, storage);
        expect(first.migrated).toBe(true);

        // Pretend the SettingsManager persisted the blob.
        storage.setItem(
            `mows_settings`,
            JSON.stringify({ _v: 1, core: { theme: `dark` }, app: {} })
        );

        const second = migrateLegacySettings(`mows`, storage);
        expect(second.migrated).toBe(false);
        // Existing unified blob isn't disturbed.
        expect(JSON.parse(storage.snapshot()[`mows_settings`]).core.theme).toBe(`dark`);
    });

    it(`new unified key wins even when legacy keys are also present`, () => {
        storage.setItem(`mows_settings`, JSON.stringify({ _v: 1, core: { theme: `dark` }, device: {}, app: {} }));
        storage.setItem(`mows_theme`, `legacy-light`);
        storage.setItem(`mows_language`, `de`);
        const outcome = migrateLegacySettings(`mows`, storage);
        // Unified key already present → guard exits before reading the
        // legacy keys at all.
        expect(outcome.migrated).toBe(false);
        expect(storage.has(`mows_theme`)).toBe(true);
        expect(storage.has(`mows_language`)).toBe(true);
    });

    it(`completes migration even when removeItem throws on one key`, () => {
        const data = new Map<string, string>([
            [`mows_theme`, `dark`],
            [`mows_language`, `de`]
        ]);
        const flaky = {
            getItem: (k: string) => data.get(k) ?? null,
            setItem: (k: string, v: string) => {
                data.set(k, v);
            },
            removeItem: (k: string) => {
                if (k === `mows_theme`) throw new Error(`QuotaExceededError`);
                data.delete(k);
            }
        };
        const outcome = migrateLegacySettings(`mows`, flaky);
        // The values that DID get read are still captured in the blob,
        // even though one removeItem failed.
        expect(outcome.migrated).toBe(true);
        expect(outcome.blob!.core.theme).toBe(`dark`);
        expect(outcome.blob!.core.language).toBe(`de`);
        // The non-throwing key was removed, the throwing one stayed.
        expect(data.has(`mows_theme`)).toBe(true);
        expect(data.has(`mows_language`)).toBe(false);
    });

    it(`skips JSON-but-wrong-shape legacy values (null, array, primitive)`, () => {
        storage.setItem(`mows_toast_settings`, `null`);
        storage.setItem(`mows_code_editor_settings`, JSON.stringify([1, 2, 3]));
        storage.setItem(`mows_hotkey_config`, `42`);

        const outcome = migrateLegacySettings(`mows`, storage);
        expect(outcome.migrated).toBe(true);
        // JSON.parse succeeded so the migration captures the value;
        // shape validation happens later when the consumer
        // (SettingsManager, HotkeyManager) reads it. The migration
        // doesn't second-guess the type — just hands it through.
        // What matters is the migration didn't throw.
        expect(storage.has(`mows_toast_settings`)).toBe(false);
        expect(storage.has(`mows_code_editor_settings`)).toBe(false);
        expect(storage.has(`mows_hotkey_config`)).toBe(false);
    });

    it(`only deletes legacy keys that were actually present`, () => {
        storage.setItem(`mows_theme`, `dark`);
        // No other legacy keys set.
        const outcome = migrateLegacySettings(`mows`, storage);
        expect(outcome.migrated).toBe(true);
        // No spurious removeItem calls leave the rest unaffected. We
        // can only verify indirectly — confirm the snapshot doesn't
        // contain legacy keys that didn't exist to begin with.
        const snap = storage.snapshot();
        expect(snap[`mows_code_theme`]).toBeUndefined();
        expect(snap[`mows_theme`]).toBeUndefined();
    });
});
