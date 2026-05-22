import { useSyncExternalStore } from "react";
import { modifierMaskFromEvent, NO_MODIFIERS, type ModifierMask } from "./ActionManager";

/**
 * Tiny external store backing {@link useModifierState}. Exactly one set of
 * `keydown` / `keyup` / `blur` listeners is attached on the `window`,
 * regardless of how many components subscribe. Snapshots are stable across
 * non-modifier key events so React doesn't tear at 60+ updates per second.
 *
 * Outside a browser (SSR / unit tests without a DOM) the store is inert —
 * subscriptions are no-ops and the snapshot stays at {@link NO_MODIFIERS}.
 */
const isBrowser = typeof window !== `undefined`;

let snapshot: ModifierMask = NO_MODIFIERS;
const subscribers = new Set<() => void>();
let listenersAttached = false;

const maskFromKeyEvent = (event: KeyboardEvent): ModifierMask => ({
    shift: event.shiftKey,
    alt: event.altKey,
    ctrl: event.ctrlKey,
    meta: event.metaKey
});

const masksEqual = (a: ModifierMask, b: ModifierMask): boolean =>
    a.shift === b.shift && a.alt === b.alt && a.ctrl === b.ctrl && a.meta === b.meta;

const setSnapshot = (next: ModifierMask) => {
    if (masksEqual(snapshot, next)) return;
    snapshot = next;
    subscribers.forEach((notify) => notify());
};

const handleKey = (event: KeyboardEvent) => {
    setSnapshot(maskFromKeyEvent(event));
};

const handleBlur = () => {
    // Window focus loss is the one moment we can no longer trust the held
    // state — the user might have released keys outside the page. Snap back
    // to "nothing held" to avoid stale Shift-style affordances.
    setSnapshot(NO_MODIFIERS);
};

const attachListeners = () => {
    if (!isBrowser || listenersAttached) return;
    window.addEventListener(`keydown`, handleKey, { capture: true });
    window.addEventListener(`keyup`, handleKey, { capture: true });
    window.addEventListener(`blur`, handleBlur);
    listenersAttached = true;
};

const detachListeners = () => {
    if (!isBrowser || !listenersAttached) return;
    window.removeEventListener(`keydown`, handleKey, { capture: true } as EventListenerOptions);
    window.removeEventListener(`keyup`, handleKey, { capture: true } as EventListenerOptions);
    window.removeEventListener(`blur`, handleBlur);
    listenersAttached = false;
    snapshot = NO_MODIFIERS;
};

const subscribe = (notify: () => void): (() => void) => {
    attachListeners();
    subscribers.add(notify);
    return () => {
        subscribers.delete(notify);
        if (subscribers.size === 0) {
            detachListeners();
        }
    };
};

const getSnapshot = (): ModifierMask => snapshot;

const getServerSnapshot = (): ModifierMask => NO_MODIFIERS;

/**
 * Seed the modifier mask from any event that carries modifier bits. Use
 * this when an event-driven entry point (e.g. a `contextmenu` handler)
 * opens UI that subscribes to {@link useModifierState} — the listeners
 * only start hearing keydown/keyup *after* subscription, so a modifier
 * that was held *before* the event would otherwise read as `false`.
 *
 * Idempotent: re-priming with the same mask is a no-op.
 */
export const primeModifierStateFromEvent = (
    event: KeyboardEvent | MouseEvent | React.KeyboardEvent | React.MouseEvent
): void => {
    setSnapshot(modifierMaskFromEvent(event));
};

/**
 * Subscribe to the live keyboard-modifier mask. Re-renders the caller
 * whenever any of Shift / Alt / Ctrl / Meta change. Cheap: one global
 * listener pair is shared by all subscribers.
 *
 * @example
 * ```tsx
 * const mods = useModifierState();
 * const label = mods.shift ? 'Delete permanently' : 'Move to bin';
 * ```
 */
export const useModifierState = (): ModifierMask =>
    useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

/**
 * Test-only helper. Forces the snapshot back to `NO_MODIFIERS` and tears
 * down the global listeners. Never call from production code.
 */
export const __resetModifierStateForTests = () => {
    snapshot = NO_MODIFIERS;
    subscribers.clear();
    detachListeners();
};
