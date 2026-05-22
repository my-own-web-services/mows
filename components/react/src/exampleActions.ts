import {
    Copy,
    FileX,
    Hand,
    Link2,
    Mail,
    MessageSquare,
    Share2,
    Trash2
} from "lucide-react";
import { createElement } from "react";
import {
    Action,
    ActionVisibility,
    type ActionVariant
} from "../lib/lib/mowsContext/ActionManager";
import type { HotkeyConfig } from "../lib/lib/mowsContext/HotkeyManager";
import type { Translation } from "./languages";

export enum ExampleActionIds {
    GREET = `example.greet`,
    COPY_TIMESTAMP = `example.copyTimestamp`,
    // Submenu demo.
    SHARE = `example.share`,
    SHARE_COPY_LINK = `example.share.copyLink`,
    SHARE_EMAIL = `example.share.email`,
    SHARE_SLACK = `example.share.slack`,
    // Modifier-variant demo.
    TRASH = `example.trash`,
    DUPLICATE = `example.duplicate`,
    // Shared-across-lists delete demo: one action, many ResourceLists.
    REPO_DELETE = `example.repoDelete`
}

export const EXAMPLE_ACTION_SCOPE = `exampleCard`;
export const EXAMPLE_SHARE_SCOPE = `exampleShareTarget`;
export const EXAMPLE_TRASH_SCOPE = `exampleTrashTarget`;
export const EXAMPLE_REPO_LIST_ITEM_SCOPE = `exampleRepoListItem`;

/**
 * Tiny per-list-id registry that lets the shared `REPO_DELETE` action route
 * an `executeAction(event)` back to the React state of the list that owns
 * the clicked row. Each `<ResourceList>` instance registers:
 *  - `deleteByIds(ids)`     — removes a batch of items from its state
 *  - `getSelectedIds()`     — current multi-selection (so right-clicking
 *                             one row in a multi-selection deletes all of
 *                             them, not just the one targeted)
 *
 * The handler reads the listId from `data-list-id` on the right-click
 * target, looks the registration up here, and either deletes the whole
 * current selection (if the right-clicked row is part of it) or just the
 * single row that was actually right-clicked.
 *
 * Module scope is fine — this state is only meaningful while the example
 * is mounted, and `useEffect` cleanup unregisters on unmount.
 */
export interface RepoListRegistration {
    readonly deleteByIds: (itemIds: ReadonlyArray<string>) => void;
    readonly getSelectedIds: () => ReadonlyArray<string>;
}
const repoListRegistry = new Map<string, RepoListRegistration>();
export const registerRepoList = (listId: string, reg: RepoListRegistration) => {
    repoListRegistry.set(listId, reg);
    return () => {
        if (repoListRegistry.get(listId) === reg) repoListRegistry.delete(listId);
    };
};

/**
 * Test-only bridge so the modifier-variant example can show which branch ran
 * without depending on real navigator APIs or modals. Each demo card reads
 * (and publishes) a tiny snapshot here through `useExampleState`.
 */
export interface TrashEvent {
    readonly variant: `move-to-bin` | `delete-permanently`;
    readonly confirmed: boolean;
    readonly when: number;
}

let trashListener: ((event: TrashEvent) => void) | undefined;
export const subscribeTrashEvents = (cb: (event: TrashEvent) => void): (() => void) => {
    trashListener = cb;
    return () => {
        if (trashListener === cb) trashListener = undefined;
    };
};
const emitTrashEvent = (event: TrashEvent) => {
    trashListener?.(event);
};

export const exampleTranslationRef: { current: Translation | null } = { current: null };

const shareCopyLinkAction = new Action({
    id: ExampleActionIds.SHARE_COPY_LINK,
    category: `Example`,
    actionHandlers: new Map([
        [
            `ShareCopyLink`,
            {
                id: `ShareCopyLink`,
                getState: () => ({
                    visibility: ActionVisibility.Shown,
                    icon: () => createElement(Link2)
                }),
                executeAction: () => {
                    navigator.clipboard.writeText(window.location.href);
                }
            }
        ]
    ])
});

const shareEmailAction = new Action({
    id: ExampleActionIds.SHARE_EMAIL,
    category: `Example`,
    actionHandlers: new Map([
        [
            `ShareEmail`,
            {
                id: `ShareEmail`,
                getState: () => ({
                    visibility: ActionVisibility.Shown,
                    icon: () => createElement(Mail)
                }),
                executeAction: () => {
                    // Demo only — no real mail client integration.
                }
            }
        ]
    ])
});

const shareSlackAction = new Action({
    id: ExampleActionIds.SHARE_SLACK,
    category: `Example`,
    actionHandlers: new Map([
        [
            `ShareSlack`,
            {
                id: `ShareSlack`,
                getState: () => ({
                    visibility: ActionVisibility.Shown,
                    icon: () => createElement(MessageSquare)
                }),
                executeAction: () => {
                    // Demo only.
                }
            }
        ]
    ])
});

export const exampleActions: Action[] = [
    new Action({
        id: ExampleActionIds.GREET,
        category: `Example`,
        actionHandlers: new Map([
            [
                `ExampleCardGreet`,
                {
                    id: `ExampleCardGreet`,
                    scopes: [EXAMPLE_ACTION_SCOPE],
                    getState: () => ({
                        visibility: ActionVisibility.Shown,
                        component: () =>
                            createElement(
                                `span`,
                                { className: `flex items-center gap-2` },
                                createElement(Hand, { className: `h-4 w-4` }),
                                exampleTranslationRef.current?.actions[
                                    ExampleActionIds.GREET
                                ] ?? `Greet`
                            )
                    }),
                    executeAction: () => {
                        const t = exampleTranslationRef.current;
                        alert(t?.example.greetAlert ?? `Hello`);
                    }
                }
            ]
        ])
    }),
    new Action({
        id: ExampleActionIds.COPY_TIMESTAMP,
        category: `Example`,
        actionHandlers: new Map([
            [
                `ExampleCardCopyTimestamp`,
                {
                    id: `ExampleCardCopyTimestamp`,
                    scopes: [EXAMPLE_ACTION_SCOPE],
                    getState: () => ({ visibility: ActionVisibility.Shown }),
                    executeAction: () => {
                        navigator.clipboard.writeText(new Date().toISOString());
                    }
                }
            ]
        ])
    }),
    // Leaf actions for the Share submenu. Registered top-level so they
    // remain addressable by id (palette / hotkeys), then referenced from
    // the Share parent's `children` resolver below.
    shareCopyLinkAction,
    shareEmailAction,
    shareSlackAction,
    // Submenu container. `children` is a function so it could depend on the
    // live modifier mask (e.g. swap channels under Alt). Here it's static.
    new Action({
        id: ExampleActionIds.SHARE,
        category: `Example`,
        actionHandlers: new Map([
            [
                `ShareParent`,
                {
                    id: `ShareParent`,
                    scopes: [EXAMPLE_SHARE_SCOPE],
                    getState: () => ({
                        visibility: ActionVisibility.Shown,
                        icon: () => createElement(Share2)
                    }),
                    children: () => [shareCopyLinkAction, shareEmailAction, shareSlackAction]
                }
            ]
        ])
    }),
    // Modifier-variant demo. Default = "Move to bin" with a confirm dialog;
    // Shift held = "Delete permanently"; Shift held + actually clicked with
    // Shift = skip the confirm. The execute logic re-reads `event.shiftKey`
    // so a Shift-up-before-click reverts to the safe path.
    new Action({
        id: ExampleActionIds.TRASH,
        category: `Example`,
        actionHandlers: new Map([
            [
                `Trash`,
                {
                    id: `Trash`,
                    scopes: [EXAMPLE_TRASH_SCOPE],
                    getState: () => ({
                        visibility: ActionVisibility.Shown,
                        icon: () => createElement(Trash2)
                    }),
                    executeAction: (event) => {
                        const confirmed =
                            typeof window === `undefined`
                                ? true
                                : window.confirm(`Move file to bin?`);
                        emitTrashEvent({
                            variant: `move-to-bin`,
                            confirmed,
                            when: Date.now()
                        });
                    },
                    variants: [
                        {
                            when: (mods) => mods.shift,
                            label: `Delete permanently`,
                            icon: () => createElement(FileX),
                            // No confirm — execute receives the actual click
                            // event, so this branch only fires when the user
                            // *still* held Shift at click time.
                            execute: (_event) => {
                                emitTrashEvent({
                                    variant: `delete-permanently`,
                                    confirmed: false,
                                    when: Date.now()
                                });
                            }
                        } satisfies ActionVariant
                    ]
                }
            ]
        ])
    }),
    new Action({
        id: ExampleActionIds.DUPLICATE,
        category: `Example`,
        actionHandlers: new Map([
            [
                `Duplicate`,
                {
                    id: `Duplicate`,
                    scopes: [EXAMPLE_TRASH_SCOPE],
                    getState: () => ({
                        visibility: ActionVisibility.Shown,
                        icon: () => createElement(Copy)
                    }),
                    executeAction: () => {}
                }
            ]
        ])
    }),
    // Shared delete across multiple ResourceLists rendered at the same
    // time. The handler is registered exactly once and dispatched by
    // GlobalContextMenu whenever the user right-clicks any element inside
    // a `[data-actionscope="exampleRepoListItem"]` region. We then walk up
    // to the nearest `[data-list-id]` / `[data-item-id]` pair to discover
    // which list owns the row — the right-click target is the source of
    // truth, so two lists can share one action without sharing state.
    new Action({
        id: ExampleActionIds.REPO_DELETE,
        category: `Example`,
        actionHandlers: new Map([
            [
                `RepoDelete`,
                {
                    id: `RepoDelete`,
                    scopes: [EXAMPLE_REPO_LIST_ITEM_SCOPE],
                    getState: () => ({
                        visibility: ActionVisibility.Shown,
                        icon: () => createElement(Trash2)
                    }),
                    executeAction: (_event, scopeElement) => {
                        // GlobalContextMenu forwards the *right-click target*
                        // as `scopeElement`. The dispatched event would
                        // otherwise be the click on the menu item — whose
                        // target is inside the floating menu DOM and has no
                        // row attributes — so we read data-* off the
                        // captured row element instead.
                        const row = scopeElement?.closest?.(
                            `[data-actionscope="${EXAMPLE_REPO_LIST_ITEM_SCOPE}"][data-item-id]`
                        ) as HTMLElement | null;
                        const listEl = row?.closest?.(`[data-list-id]`) as HTMLElement | null;
                        const itemId = row?.dataset.itemId;
                        const listId = listEl?.dataset.listId;
                        if (!itemId || !listId) return;
                        const reg = repoListRegistry.get(listId);
                        if (!reg) return;
                        // If the right-clicked row is part of the current
                        // multi-selection, the user means "delete all of
                        // them". Otherwise — clicking an unselected row —
                        // delete just that one.
                        const selected = reg.getSelectedIds();
                        const targets =
                            selected.includes(itemId) && selected.length > 0
                                ? selected
                                : [itemId];
                        reg.deleteByIds(targets);
                    }
                }
            ]
        ])
    })
];

export const exampleDefaultHotkeys: HotkeyConfig = {
    [ExampleActionIds.GREET]: {
        // mod = Cmd on Mac, Ctrl elsewhere. Mod+Alt+G is unused by Brave /
        // Chromium / Firefox so the action handler can preventDefault freely.
        keyCombinations: [`mod+alt+g`]
    }
};
