import { log } from "../logging";
import type { UndoableAction } from "./ActionManager";

/**
 * Minimal storage adapter for the undo + redo stacks. Mirrors
 * `SettingsStorageAdapter` shape so React Native or SSR consumers can
 * swap backends. Defaults to a sessionStorage-backed adapter; tests pass
 * an in-memory fake.
 */
export interface UndoStackStorageAdapter {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

const browserSession: UndoStackStorageAdapter | undefined =
    typeof sessionStorage !== `undefined` ? sessionStorage : undefined;

/** Two distinct stacks live behind one manager so callers don't juggle
 * separate persistence + fallback wiring. */
type Stack = `undo` | `redo`;

/**
 * Persists the undo AND redo stacks in sessionStorage (per-tab; never
 * cross-tab — undo across tabs is a footgun). Falls back to an in-memory
 * stack when sessionStorage is unavailable (Safari private mode, embedded
 * iframes) with a single warning so the user understands undo will not
 * survive a reload in that environment.
 *
 * Both stacks survive reload within the same tab. The plan originally
 * marked persisted-redo as a v2 deferral; lifting it into v1 cost almost
 * nothing once undo was already persisted (same adapter, same shape)
 * and removed an obvious UX surprise — reload would silently drop the
 * user's redo history. The redo stack is cleared by `ActionManager` on
 * any new undoable dispatch; this manager just persists what it's told.
 */
export class UndoStackManager {
    private readonly storageKeys: Record<Stack, string>;
    private readonly storage: UndoStackStorageAdapter | undefined;
    private readonly memoryFallback: Record<Stack, UndoableAction[]> = {
        undo: [],
        redo: []
    };
    private useMemoryFallback = false;
    private hasWarnedFallback = false;

    constructor(opts: { storagePrefix: string; storage?: UndoStackStorageAdapter }) {
        this.storageKeys = {
            undo: `${opts.storagePrefix}_undoStack`,
            redo: `${opts.storagePrefix}_redoStack`
        };
        this.storage = opts.storage ?? browserSession;
    }

    // ---- Public surface — kept narrow on purpose -----------------------

    /** Snapshot of the undo stack (oldest → newest). */
    getStack = (): UndoableAction[] => this.read(`undo`);
    /** Snapshot of the redo stack (oldest → newest); newest is the next
     * entry a redo would re-apply. */
    getRedoStack = (): UndoableAction[] => this.read(`redo`);

    /** Atomic replacement of the undo stack. */
    replace = (next: UndoableAction[]): void => this.write(`undo`, next);
    replaceRedo = (next: UndoableAction[]): void => this.write(`redo`, next);

    /** Wipe both stacks. Used by the "Clear history" affordance. */
    clear = (): void => {
        this.write(`undo`, []);
        this.write(`redo`, []);
        if (!this.useMemoryFallback && this.storage) {
            try {
                this.storage.removeItem(this.storageKeys.undo);
                this.storage.removeItem(this.storageKeys.redo);
            } catch (error) {
                log.warn(`UndoStackManager.clear failed to delete storage`, error);
                this.fallbackToMemory();
            }
        }
    };

    /** True once any storage operation has thrown and we've switched to
     * in-memory mode. Exposed for tests and for the optional one-shot
     * "undo will not persist this session" toast. */
    isUsingMemoryFallback = (): boolean => this.useMemoryFallback;

    // ---- Internals ----------------------------------------------------

    private read(stack: Stack): UndoableAction[] {
        if (this.useMemoryFallback || !this.storage) {
            return this.memoryFallback[stack];
        }
        try {
            const raw = this.storage.getItem(this.storageKeys[stack]);
            if (!raw) return [];
            const parsed = JSON.parse(raw) as unknown;
            if (!Array.isArray(parsed)) return [];
            // Defensive: drop entries that aren't shaped like UndoableAction.
            return parsed.filter(
                (entry): entry is UndoableAction =>
                    !!entry &&
                    typeof entry === `object` &&
                    typeof (entry as UndoableAction).actionId === `string` &&
                    typeof (entry as UndoableAction).id === `string`
            );
        } catch (error) {
            log.warn(`UndoStackManager.read(${stack}) failed`, error);
            this.fallbackToMemory();
            return this.memoryFallback[stack];
        }
    }

    private write(stack: Stack, next: UndoableAction[]): void {
        if (this.useMemoryFallback || !this.storage) {
            this.memoryFallback[stack] = [...next];
            return;
        }
        try {
            this.storage.setItem(this.storageKeys[stack], JSON.stringify(next));
        } catch (error) {
            log.warn(`UndoStackManager.write(${stack}) failed`, error);
            this.fallbackToMemory();
            this.memoryFallback[stack] = [...next];
        }
    }

    private fallbackToMemory(): void {
        if (this.useMemoryFallback) return;
        this.useMemoryFallback = true;
        // Seed in-memory copies from whatever the last successful read
        // gave us — if storage is now broken, an empty start is the best
        // we can do.
        this.memoryFallback.undo = [];
        this.memoryFallback.redo = [];
        if (!this.hasWarnedFallback) {
            log.warn(
                `UndoStackManager: sessionStorage is unavailable; undo/redo stacks will not survive reload this session`
            );
            this.hasWarnedFallback = true;
        }
    }
}
