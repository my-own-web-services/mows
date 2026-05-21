// Promise-based confirm/prompt singletons backed by a Dialog modal.
//
// Calling `requestConfirm(...)` or `requestPrompt(...)` from non-React code
// (e.g. lib/actions.ts) returns a Promise that resolves when the user
// dismisses the modal. A single <ModalHost /> mounted from App.tsx subscribes
// to the state and renders the actual UI — no `window.confirm`/`prompt`.

export interface ConfirmRequest {
    readonly kind: "confirm";
    readonly title: string;
    readonly description: string;
    readonly confirmLabel: string;
    readonly cancelLabel: string;
    readonly danger: boolean;
    readonly resolve: (ok: boolean) => void;
}

export interface PromptRequest {
    readonly kind: "prompt";
    readonly title: string;
    readonly description?: string;
    readonly initial: string;
    readonly placeholder?: string;
    readonly confirmLabel: string;
    readonly cancelLabel: string;
    readonly resolve: (value: string | null) => void;
}

export type VmImageChoice = "alpine" | "ubuntu" | "debian" | "nixos";
export type VmDisplayModeChoice = "headless" | "desktop";

export interface VmCreateInput {
    readonly name: string;
    readonly cwd: string;
    readonly cpus: number | null;
    readonly memoryMb: number | null;
    readonly image: VmImageChoice;
    readonly displayMode: VmDisplayModeChoice;
}

export interface VmCreateRequest {
    readonly kind: "vm-create";
    readonly title: string;
    readonly description?: string;
    readonly initial: VmCreateInput;
    readonly confirmLabel: string;
    readonly cancelLabel: string;
    readonly resolve: (value: VmCreateInput | null) => void;
}

export type ModalRequest = ConfirmRequest | PromptRequest | VmCreateRequest;

type Listener = (r: ModalRequest | null) => void;

let current: ModalRequest | null = null;
const listeners = new Set<Listener>();

const set = (r: ModalRequest | null): void => {
    current = r;
    listeners.forEach((fn) => fn(r));
};

export const getCurrentModal = (): ModalRequest | null => current;

export const subscribeModal = (fn: Listener): (() => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
};

export interface ConfirmOptions {
    readonly title: string;
    readonly description: string;
    readonly confirmLabel?: string;
    readonly cancelLabel?: string;
    readonly danger?: boolean;
}

export const requestConfirm = (opts: ConfirmOptions): Promise<boolean> =>
    new Promise<boolean>((resolve) => {
        set({
            kind: "confirm",
            title: opts.title,
            description: opts.description,
            confirmLabel: opts.confirmLabel ?? "Confirm",
            cancelLabel: opts.cancelLabel ?? "Cancel",
            danger: opts.danger ?? false,
            resolve: (ok) => {
                set(null);
                resolve(ok);
            }
        });
    });

export interface PromptOptions {
    readonly title: string;
    readonly description?: string;
    readonly initial?: string;
    readonly placeholder?: string;
    readonly confirmLabel?: string;
    readonly cancelLabel?: string;
}

export interface VmCreateOptions {
    readonly title?: string;
    readonly description?: string;
    readonly initial?: Partial<VmCreateInput>;
    readonly confirmLabel?: string;
    readonly cancelLabel?: string;
}

export const requestNewVm = (
    opts: VmCreateOptions = {}
): Promise<VmCreateInput | null> =>
    new Promise<VmCreateInput | null>((resolve) => {
        set({
            kind: "vm-create",
            title: opts.title ?? "Create VM",
            description: opts.description,
            initial: {
                name: opts.initial?.name ?? "",
                cwd: opts.initial?.cwd ?? "",
                cpus: opts.initial?.cpus ?? null,
                memoryMb: opts.initial?.memoryMb ?? null,
                image: opts.initial?.image ?? "alpine",
                displayMode: opts.initial?.displayMode ?? "headless"
            },
            confirmLabel: opts.confirmLabel ?? "Create",
            cancelLabel: opts.cancelLabel ?? "Cancel",
            resolve: (value) => {
                set(null);
                resolve(value);
            }
        });
    });

export const requestPrompt = (opts: PromptOptions): Promise<string | null> =>
    new Promise<string | null>((resolve) => {
        set({
            kind: "prompt",
            title: opts.title,
            description: opts.description,
            initial: opts.initial ?? "",
            placeholder: opts.placeholder,
            confirmLabel: opts.confirmLabel ?? "OK",
            cancelLabel: opts.cancelLabel ?? "Cancel",
            resolve: (value) => {
                set(null);
                resolve(value);
            }
        });
    });
