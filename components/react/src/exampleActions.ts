import { Hand } from "lucide-react";
import { createElement } from "react";
import { Action, ActionVisibility } from "../lib/lib/mowsContext/ActionManager";
import type { HotkeyConfig } from "../lib/lib/mowsContext/HotkeyManager";
import type { Translation } from "./languages";

export enum ExampleActionIds {
    GREET = `example.greet`,
    COPY_TIMESTAMP = `example.copyTimestamp`
}

export const EXAMPLE_ACTION_SCOPE = `exampleCard`;

export const exampleTranslationRef: { current: Translation | null } = { current: null };

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
    })
];

export const exampleDefaultHotkeys: HotkeyConfig = {
    [ExampleActionIds.GREET]: {
        // mod = Cmd on Mac, Ctrl elsewhere. Mod+Alt+G is unused by Brave /
        // Chromium / Firefox so the action handler can preventDefault freely.
        keyCombinations: [`mod+alt+g`]
    }
};
