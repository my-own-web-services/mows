import { log } from "../logging";

/**
 * Unified settings model — every value the library and consumer apps
 * persist between sessions lives inside ONE JSON blob under a single
 * localStorage key (`${storagePrefix}_settings`). The blob is split:
 *
 * - `core` — settings owned by `@my-own-web-services/react-components`
 *   itself (theme, language, hotkeys, …). The shape is stable and
 *   versioned (`_v`) because a future Settings API will sync this slot
 *   across apps + devices.
 * - `app` — sub-keyed by app (`app.<appKey>.<settingId>`). Each
 *   consumer app registers its own schema via `defineAppSettings` and
 *   only ever reads/writes through its own typed hooks. Stays
 *   device-local even when `core` is later remote-synced.
 *
 * Putting everything under one key is the entire point — a user can
 * copy that JSON blob, paste it into another browser/install of the
 * same app, and recover the complete UX preference set in one step.
 */
export const SETTINGS_BLOB_VERSION = 1 as const;

export interface SettingsBlob {
    readonly _v: typeof SETTINGS_BLOB_VERSION;
    /** Truly portable preferences: theme, language, code-editor toggles,
     * etc. This slot is what a future Settings API will sync across
     * devices for the same user. */
    readonly core: CoreSettings;
    /** Device-local ephemeral state: hotkey overrides + recent-actions
     * MRU. Lives in the same blob (one-key export still includes it)
     * but is intentionally outside `core` so the future remote-sync
     * provider doesn't shove your colleague's MRU history at your
     * client. */
    readonly device: DeviceSettings;
    /** Consumer-app slot, sub-keyed by `appKey`. Stays device-local. */
    readonly app: AppSettingsRecord;
}

/**
 * Slice of the blob owned by the library. Every key is optional —
 * undefined means "use the lib default" so an empty blob on first run
 * behaves identically to a missing key in the legacy model.
 */
export interface CoreSettings {
    readonly theme?: string;
    readonly codeTheme?: string;
    readonly language?: string;
    readonly mapStyle?: string;
    readonly codeEditor?: Record<string, unknown>;
    readonly toast?: Record<string, unknown>;
    /** Display unit for components that render temperatures (e.g.
     * `<WeatherExpandable>`). Accepts `"celsius" | "fahrenheit" |
     * "kelvin"`. Stored as a free string here so SettingsManager
     * stays decoupled from the weather component's types — MowsContext
     * narrows at the boundary. */
    readonly temperatureUnit?: string;
}

export interface DeviceSettings {
    /** Subset of HotkeyConfig — kept as `unknown` here so SettingsManager
     * stays decoupled from HotkeyManager's types. HotkeyManager parses + validates. */
    readonly hotkeyConfig?: unknown;
    /** Recent actions list owned by ActionManager. */
    readonly recentActions?: unknown;
    /** Append-only audit log of dispatched actions. Owned by ActionManager.
     * Persisted here (in `device.*`, not `core.*`) because it's
     * device-local and intentionally not part of the future cross-device
     * Settings-API sync slot. Shape: `AuditEntry[]` but kept as `unknown`
     * to keep SettingsManager decoupled from ActionManager's types. */
    readonly auditLog?: unknown;
    /** User-tunable caps for the audit-log + undo-stack system. Shape:
     * partial `ActionHistoryConfig`. */
    readonly actionHistory?: unknown;
}

export type AppSettingsRecord = Readonly<Record<string, Readonly<Record<string, unknown>>>>;

export const emptySettingsBlob = (): SettingsBlob => ({
    _v: SETTINGS_BLOB_VERSION,
    core: {},
    device: {},
    app: {}
});

/**
 * Minimal storage interface so the manager can be tested with a
 * fake (no DOM required) AND so the future remote-sync layer for
 * `core` can be slotted in without touching consumers. Mirrors the
 * `Storage` API surface we actually use.
 */
export interface SettingsStorageAdapter {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

const browserStorage: SettingsStorageAdapter | undefined =
    typeof localStorage !== `undefined` ? localStorage : undefined;

type Listener = () => void;
type Unsubscribe = () => void;

/**
 * Holds the single settings blob in memory, persists the whole blob on
 * every change, and supports per-path subscriptions (so a component
 * watching `app.filez.defaultView` re-renders only when that one value
 * changes, not on every settings write).
 *
 * Persistence is intentionally synchronous: settings writes are rare
 * (user clicks a picker) and we want the next page load to see the
 * change even if the tab crashes mid-render. If this ever becomes a
 * hot path, debounce here — the adapter contract doesn't change.
 */
export class SettingsManager {
    private readonly storageKey: string;
    private readonly storage: SettingsStorageAdapter | undefined;
    private readonly onPersistError?: (error: unknown) => void;
    private blob: SettingsBlob;
    private readonly listeners = new Map<string, Set<Listener>>();
    /** Bound handler for window `storage` events — kept as a field so
     * `destroy()` can remove it. Stays undefined when there's no `window`
     * (SSR / tests without jsdom window). */
    private readonly storageEventHandler?: (event: StorageEvent) => void;

    constructor(opts: {
        storagePrefix: string;
        storage?: SettingsStorageAdapter;
        /**
         * Seed the blob (used by the legacy-migration helper to install
         * the migration result before the manager's first read). If
         * provided, no read from storage is performed during
         * construction.
         */
        initialBlob?: SettingsBlob;
        /**
         * Invoked when persisting fails (quota exceeded, private mode,
         * storage disabled). Caller decides whether to toast the user
         * or just log. Defaults to a `log.warn` — settings stay in
         * memory either way; we don't drop the in-memory write.
         */
        onPersistError?: (error: unknown) => void;
    }) {
        this.storageKey = `${opts.storagePrefix}_settings`;
        this.storage = opts.storage ?? browserStorage;
        this.onPersistError = opts.onPersistError;
        if (opts.initialBlob) {
            const validation = validateBlob(opts.initialBlob);
            if (!validation.valid) {
                // Pre-seed blobs only come from the legacy-migration
                // helper today, so a failure here is a coding bug. Fail
                // loud rather than silently dropping migrated data.
                throw new SettingsBlobValidationError(validation.reason);
            }
            this.blob = normaliseBlob(validation.blob);
            this.persistNow();
        } else {
            this.blob = this.readBlob();
        }

        // Cross-tab sync: when another tab writes the same key, the
        // browser fires a `storage` event in *other* tabs (not the
        // writing tab — so this never loops). Re-read the blob and
        // notify subscribers. Suppress when there's no window (SSR).
        if (typeof window !== `undefined`) {
            this.storageEventHandler = (event: StorageEvent) => {
                if (event.key !== this.storageKey) return;
                // Re-read defensively rather than parsing newValue — the
                // adapter may be a mock and the validator path is the
                // canonical entry for new data.
                const next = this.readBlob();
                this.blob = next;
                this.notifyAll();
            };
            try {
                window.addEventListener(`storage`, this.storageEventHandler);
            } catch (error) {
                log.warn(`SettingsManager could not subscribe to cross-tab storage events`, error);
            }
        }
    }

    /** Remove DOM listeners. Call from `componentWillUnmount` to avoid a
     * leaked reference when MowsProvider unmounts. */
    destroy = (): void => {
        if (typeof window !== `undefined` && this.storageEventHandler) {
            try {
                window.removeEventListener(`storage`, this.storageEventHandler);
            } catch {
                // Best-effort cleanup; nothing actionable on failure.
            }
        }
        this.listeners.clear();
    };

    // ---- Public read/write surface --------------------------------

    getBlob = (): SettingsBlob => this.blob;

    /**
     * Replace the entire blob (e.g. user pastes JSON in the import tab).
     * Throws `SettingsBlobValidationError` when the input fails
     * `validateBlob` — caller decides whether to surface the message.
     */
    replaceBlob = (next: SettingsBlob): void => {
        const result = validateBlob(next);
        if (!result.valid) {
            throw new SettingsBlobValidationError(result.reason);
        }
        this.blob = normaliseBlob(result.blob);
        this.persistNow();
        this.notifyAll();
    };

    getCore = <K extends keyof CoreSettings>(key: K): CoreSettings[K] => this.blob.core[key];

    setCore = <K extends keyof CoreSettings>(key: K, value: CoreSettings[K]): void => {
        // Preserve referential stability for unchanged slices so React
        // selectors that compare by identity stay cheap.
        if (this.blob.core[key] === value) return;
        this.blob = {
            ...this.blob,
            core: { ...this.blob.core, [key]: value }
        };
        this.persistNow();
        this.notify(`core.${String(key)}`);
    };

    getDevice = <K extends keyof DeviceSettings>(key: K): DeviceSettings[K] =>
        this.blob.device[key];

    setDevice = <K extends keyof DeviceSettings>(key: K, value: DeviceSettings[K]): void => {
        if (this.blob.device[key] === value) return;
        this.blob = {
            ...this.blob,
            device: { ...this.blob.device, [key]: value }
        };
        this.persistNow();
        this.notify(`device.${String(key)}`);
    };

    getApp = <T = unknown>(appKey: string, settingId: string): T | undefined =>
        this.blob.app[appKey]?.[settingId] as T | undefined;

    setApp = (appKey: string, settingId: string, value: unknown): void => {
        const current = this.blob.app[appKey]?.[settingId];
        if (current === value) return;
        const appSlice = { ...(this.blob.app[appKey] ?? {}), [settingId]: value };
        this.blob = {
            ...this.blob,
            app: { ...this.blob.app, [appKey]: appSlice }
        };
        this.persistNow();
        this.notify(`app.${appKey}.${settingId}`);
    };

    /**
     * Subscribe to a path. Listeners fire when the value at `path`
     * (or any ancestor — e.g. `replaceBlob` notifies everyone) changes.
     * Returns an unsubscribe function.
     */
    subscribe = (path: string, listener: Listener): Unsubscribe => {
        let bucket = this.listeners.get(path);
        if (!bucket) {
            bucket = new Set();
            this.listeners.set(path, bucket);
        }
        bucket.add(listener);
        return () => {
            const b = this.listeners.get(path);
            if (!b) return;
            b.delete(listener);
            if (b.size === 0) this.listeners.delete(path);
        };
    };

    /**
     * Adapter handed to consumers of a single core slot. Used today by
     * SettingsPanel pickers that prefer a focused interface over the
     * full manager surface.
     */
    coreSlotAdapter = <K extends keyof CoreSettings>(
        key: K
    ): { get: () => CoreSettings[K]; set: (value: CoreSettings[K]) => void } => ({
        get: () => this.getCore(key),
        set: (value) => this.setCore(key, value)
    });

    /**
     * Adapter handed to HotkeyManager / ActionManager so they keep
     * their own parsing logic but read/write through the unified blob
     * instead of their own localStorage keys. Each manager owns a
     * dedicated slot in `device.*`, kept out of `core` because hotkey
     * overrides + recent-action MRU are per-device and should not be
     * synced across the user's other installs.
     */
    deviceSlotAdapter = <K extends keyof DeviceSettings>(
        key: K
    ): { get: () => DeviceSettings[K]; set: (value: DeviceSettings[K]) => void } => ({
        get: () => this.getDevice(key),
        set: (value) => this.setDevice(key, value)
    });

    // ---- Internals -------------------------------------------------

    private readBlob = (): SettingsBlob => {
        if (!this.storage) return emptySettingsBlob();
        const raw = this.storage.getItem(this.storageKey);
        if (!raw) return emptySettingsBlob();
        let parsed: unknown;
        try {
            parsed = JSON.parse(raw);
        } catch (error) {
            log.warn(
                `Failed to parse stored settings blob at ${this.storageKey}; reverting to defaults`,
                error
            );
            return emptySettingsBlob();
        }
        const validation = validateBlob(parsed);
        if (!validation.valid) {
            log.warn(
                `Stored settings blob at ${this.storageKey} failed validation (${validation.reason}); reverting to defaults — ` +
                    `if this is a future _v, add a migration in validateBlob.`
            );
            return emptySettingsBlob();
        }
        return normaliseBlob(validation.blob);
    };

    private persistNow = (): void => {
        if (!this.storage) return;
        try {
            this.storage.setItem(this.storageKey, JSON.stringify(this.blob));
        } catch (error) {
            log.warn(`Failed to persist settings blob to ${this.storageKey}`, error);
            this.onPersistError?.(error);
        }
    };

    private notify = (path: string): void => {
        // Fire exact-path listeners, then every ancestor — e.g. setting
        // `app.filez.defaultView` notifies `app.filez.defaultView`,
        // `app.filez`, `app`, and `*` watchers.
        for (const ancestor of expandAncestors(path)) {
            this.fireBucket(this.listeners.get(ancestor));
        }
        this.fireBucket(this.listeners.get(`*`));
    };

    private notifyAll = (): void => {
        for (const bucket of this.listeners.values()) {
            this.fireBucket(bucket);
        }
    };

    /**
     * Invoke every listener in a bucket. Two invariants matter:
     *
     *  1. A listener that unsubscribes itself mid-call must not skip
     *     siblings — so we iterate a *snapshot* taken before calling.
     *  2. A listener that throws must not abort the rest of the
     *     notification cycle nor block persistence — so we catch and
     *     log per-listener.
     */
    private fireBucket = (bucket: Set<Listener> | undefined): void => {
        if (!bucket || bucket.size === 0) return;
        const snapshot = Array.from(bucket);
        for (const listener of snapshot) {
            try {
                listener();
            } catch (error) {
                log.error(`SettingsManager subscriber threw; continuing`, error);
            }
        }
    };
}

/**
 * Build the list of subscription paths a write at `path` should
 * notify. Bottom-up: exact path first, then each containing slice.
 */
const expandAncestors = (path: string): string[] => {
    const parts = path.split(`.`);
    const result: string[] = [];
    for (let i = parts.length; i > 0; i--) {
        result.push(parts.slice(0, i).join(`.`));
    }
    return result;
};

/**
 * Coerce a *validated* blob into the current shape. Assumes
 * `validateBlob` has already rejected wrong-version / wrong-shape
 * inputs — this helper just normalises the optional `core` / `app`
 * keys so callers never have to null-check them.
 */
const normaliseBlob = (input: Partial<SettingsBlob>): SettingsBlob => {
    const core =
        input.core && typeof input.core === `object` ? (input.core as CoreSettings) : {};
    const device =
        input.device && typeof input.device === `object`
            ? (input.device as DeviceSettings)
            : {};
    const app =
        input.app && typeof input.app === `object` ? (input.app as AppSettingsRecord) : {};
    return {
        _v: SETTINGS_BLOB_VERSION,
        core,
        device,
        app
    };
};

export class SettingsBlobValidationError extends Error {
    constructor(reason: string) {
        super(`Invalid settings blob: ${reason}`);
        this.name = `SettingsBlobValidationError`;
    }
}

export type BlobValidationResult =
    | { readonly valid: true; readonly blob: SettingsBlob }
    | { readonly valid: false; readonly reason: string };

/**
 * Pure-function validator for an incoming blob (from JSON-import tab,
 * from disk on first read, or from a future remote-sync provider).
 * Keeps the version contract enforcement in one place so every entry
 * point gets the same checks.
 *
 * Today only `_v: 1` is accepted. When `_v: 2` lands, dispatch via
 * `switch (input._v) { … }` and run a migration step before returning
 * `{ valid: true, blob: upgraded }`.
 */
export const validateBlob = (input: unknown): BlobValidationResult => {
    if (input === null || typeof input !== `object`) {
        return { valid: false, reason: `expected an object, got ${typeof input}` };
    }
    const candidate = input as {
        _v?: unknown;
        core?: unknown;
        device?: unknown;
        app?: unknown;
    };
    if (candidate._v !== SETTINGS_BLOB_VERSION) {
        return {
            valid: false,
            reason: `_v must be ${SETTINGS_BLOB_VERSION}, got ${JSON.stringify(candidate._v)}`
        };
    }
    if (candidate.core !== undefined && (candidate.core === null || typeof candidate.core !== `object` || Array.isArray(candidate.core))) {
        return { valid: false, reason: `core must be an object (or omitted)` };
    }
    if (candidate.device !== undefined && (candidate.device === null || typeof candidate.device !== `object` || Array.isArray(candidate.device))) {
        return { valid: false, reason: `device must be an object (or omitted)` };
    }
    if (candidate.app !== undefined && (candidate.app === null || typeof candidate.app !== `object` || Array.isArray(candidate.app))) {
        return { valid: false, reason: `app must be an object (or omitted)` };
    }
    return { valid: true, blob: input as SettingsBlob };
};
