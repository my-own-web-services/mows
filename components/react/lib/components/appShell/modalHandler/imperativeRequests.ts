// Promise-based confirm/alert/prompt singletons backed by ModalHandler.
//
// Calling any of `requestConfirm` / `requestAlert` / `requestPrompt` from
// non-React code (e.g. an ActionManager handler or a lib/foo.ts helper)
// returns a Promise that resolves when the user dismisses the modal. A
// single <ModalHandler/> subscribes to this store and renders the actual
// dialog. Concurrent requests are queued — the second only opens once the
// first resolves, so a chain of imperative calls never overwrites itself.

export interface ConfirmOptions {
    readonly title: string;
    readonly description?: string;
    readonly confirmLabel?: string;
    readonly cancelLabel?: string;
    readonly danger?: boolean;
}

export interface AlertOptions {
    readonly title: string;
    readonly description?: string;
    readonly dismissLabel?: string;
    readonly severity?: "info" | "warning" | "error" | "success";
}

export interface PromptOptions {
    readonly title: string;
    readonly description?: string;
    readonly initial?: string;
    readonly placeholder?: string;
    readonly confirmLabel?: string;
    readonly cancelLabel?: string;
    /** Synchronous validator: return `null` to allow confirm, or a string to
     *  show as inline error and disable the confirm button. */
    readonly validate?: (value: string) => string | null;
}

interface RequestInternal {
    /** Monotonically increasing id, used by hosts as a React key so the
     *  rendered slot fully remounts between queued requests (clean focus,
     *  fresh prompt state). Not part of the public options. */
    readonly id: number;
}

export type ImperativeRequest =
    | (ConfirmOptions & RequestInternal & { readonly kind: "confirm"; readonly resolve: (ok: boolean) => void })
    | (AlertOptions & RequestInternal & { readonly kind: "alert"; readonly resolve: () => void })
    | (PromptOptions & RequestInternal & { readonly kind: "prompt"; readonly resolve: (value: string | null) => void });

type Listener = (request: ImperativeRequest | null) => void;

let current: ImperativeRequest | null = null;
const queue: ImperativeRequest[] = [];
const listeners = new Set<Listener>();
let nextId = 1;

// Snapshot the listener set before iterating so a listener that calls back
// into `request*()` reentrantly (e.g. enqueuing a follow-up modal from a
// resolve handler) doesn't mutate the iteration target mid-loop.
const notify = (): void => {
    [...listeners].forEach((listener) => listener(current));
};

const enqueue = (request: ImperativeRequest): void => {
    if (current === null) {
        current = request;
        notify();
        return;
    }
    queue.push(request);
};

export const requestConfirm = (opts: ConfirmOptions): Promise<boolean> =>
    new Promise<boolean>((resolve) => {
        enqueue({ ...opts, kind: `confirm`, id: nextId++, resolve });
    });

export const requestAlert = (opts: AlertOptions): Promise<void> =>
    new Promise<void>((resolve) => {
        enqueue({ ...opts, kind: `alert`, id: nextId++, resolve });
    });

export const requestPrompt = (opts: PromptOptions): Promise<string | null> =>
    new Promise<string | null>((resolve) => {
        enqueue({ ...opts, kind: `prompt`, id: nextId++, resolve });
    });

export const subscribeImperativeRequests = (listener: Listener): (() => void) => {
    listeners.add(listener);
    // Replay current state synchronously so a host mounted after enqueue
    // still picks up the open request.
    listener(current);
    return () => {
        listeners.delete(listener);
    };
};

/** Host-only: advance to the next queued request (or `null` if empty) and
 *  notify listeners synchronously so there's no flash of empty state. */
export const resolveCurrentImperativeRequest = (result: unknown): void => {
    const active = current;
    if (active === null) return;
    current = queue.shift() ?? null;
    notify();

    // Resolve the original promise AFTER we've advanced the queue, so a
    // .then() handler that calls request*() reentrantly enqueues onto a
    // clean state rather than racing with the in-flight notification.
    if (active.kind === `confirm`) {
        active.resolve(result as boolean);
    } else if (active.kind === `alert`) {
        active.resolve();
    } else {
        active.resolve(result as string | null);
    }
};

/** Test-only: drop any in-flight state. Not exported from the package. */
export const __resetImperativeRequestsForTests = (): void => {
    current = null;
    queue.length = 0;
    listeners.clear();
    nextId = 1;
};
