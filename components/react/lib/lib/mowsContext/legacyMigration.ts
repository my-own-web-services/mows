import { log } from "../logging";
import {
    emptySettingsBlob,
    type SettingsBlob,
    type SettingsStorageAdapter
} from "./SettingsManager";

/**
 * One-shot migration from the legacy "one localStorage key per
 * concern" layout to the unified blob at `${storagePrefix}_settings`.
 *
 * Designed to be safe to call on every mount:
 *
 * - If the new key already exists, the function exits without
 *   touching anything (so a second mount after first-run migration is
 *   a no-op).
 * - If none of the legacy keys exist either, it also exits (fresh
 *   install — let SettingsManager start from an empty blob).
 * - Otherwise it reads each legacy key, populates the matching slot
 *   in a fresh blob, deletes every legacy key that was actually
 *   present, and returns the merged blob. Caller (MowsClientManager)
 *   passes that blob to `SettingsManager`'s `initialBlob` option so
 *   it gets persisted as the new unified record in the same tick.
 *
 * Parse failures on a legacy JSON value (toast / codeEditor / hotkey
 * config / recent actions) are logged and skipped — the corresponding
 * slot stays unset, the lib will fall back to its hard-coded default
 * on next read. We do NOT silently drop a corrupt key from storage
 * without surfacing the problem in the console so a real
 * data-corruption bug doesn't disappear.
 */

const legacyKeys = (prefix: string) =>
    ({
        theme: `${prefix}_theme`,
        codeTheme: `${prefix}_code_theme`,
        codeEditor: `${prefix}_code_editor_settings`,
        toast: `${prefix}_toast_settings`,
        mapStyle: `${prefix}_map_style`,
        language: `${prefix}_language`,
        hotkeyConfig: `${prefix}_hotkey_config`,
        recentActions: `${prefix}_recent_actions`
    }) as const;

const NEW_KEY_SUFFIX = `_settings`;

export interface LegacyMigrationOutcome {
    /** True if the function actually wrote a new blob. False on
     * no-op (new key present, or no legacy keys present). */
    readonly migrated: boolean;
    /** The blob to seed SettingsManager with. `undefined` when nothing
     * needed migrating (caller falls through to SettingsManager's
     * normal read path). */
    readonly blob?: SettingsBlob;
}

export const migrateLegacySettings = (
    storagePrefix: string,
    storage: SettingsStorageAdapter
): LegacyMigrationOutcome => {
    const newKey = `${storagePrefix}${NEW_KEY_SUFFIX}`;
    if (storage.getItem(newKey) !== null) {
        // Already migrated — leave everything alone.
        return { migrated: false };
    }

    const keys = legacyKeys(storagePrefix);
    const present: Array<keyof ReturnType<typeof legacyKeys>> = [];

    const blob: {
        _v: 1;
        core: Record<string, unknown>;
        device: Record<string, unknown>;
        app: Record<string, Record<string, unknown>>;
    } = { ...emptySettingsBlob(), core: {}, device: {}, app: {} };

    const readString = (key: keyof ReturnType<typeof legacyKeys>): string | null => {
        const raw = storage.getItem(keys[key]);
        if (raw === null) return null;
        present.push(key);
        return raw;
    };

    const readJson = <T>(key: keyof ReturnType<typeof legacyKeys>): T | undefined => {
        const raw = readString(key);
        if (raw === null) return undefined;
        try {
            return JSON.parse(raw) as T;
        } catch (error) {
            log.warn(
                `Failed to parse legacy settings value at ${keys[key]} during migration; ` +
                    `dropping this slot, lib will fall back to defaults`,
                error
            );
            return undefined;
        }
    };

    const theme = readString(`theme`);
    if (theme !== null) blob.core.theme = theme;

    const codeTheme = readString(`codeTheme`);
    if (codeTheme !== null) blob.core.codeTheme = codeTheme;

    const mapStyle = readString(`mapStyle`);
    if (mapStyle !== null) blob.core.mapStyle = mapStyle;

    const language = readString(`language`);
    if (language !== null) blob.core.language = language;

    const codeEditor = readJson<Record<string, unknown>>(`codeEditor`);
    if (codeEditor !== undefined) blob.core.codeEditor = codeEditor;

    const toast = readJson<Record<string, unknown>>(`toast`);
    if (toast !== undefined) blob.core.toast = toast;

    // Hotkey overrides + recent-actions MRU are per-device and live
    // under the `device` slot — kept out of `core` so the future
    // remote-sync provider for `core` doesn't propagate machine-local
    // state across the user's other installs.
    const hotkeyConfig = readJson<unknown>(`hotkeyConfig`);
    if (hotkeyConfig !== undefined) blob.device.hotkeyConfig = hotkeyConfig;

    const recentActions = readJson<unknown>(`recentActions`);
    if (recentActions !== undefined) blob.device.recentActions = recentActions;

    if (present.length === 0) {
        // Fresh install: no new key AND no legacy keys. Let
        // SettingsManager start from an empty blob via its own read path.
        return { migrated: false };
    }

    // Delete every legacy key we just read — if we leave them around,
    // a future bug that reads a legacy key directly would see stale
    // values. Only delete the ones that existed (don't churn keys we
    // never touched).
    for (const key of present) {
        try {
            storage.removeItem(keys[key]);
        } catch (error) {
            // Quota / private mode / cross-origin frames can throw on
            // removeItem. We've already captured the value into the
            // blob in memory, so the migration result is still
            // correct; log and continue.
            log.warn(`Failed to remove legacy key ${keys[key]} after migration`, error);
        }
    }

    return { migrated: true, blob: blob as SettingsBlob };
};
