import { useEffect, useState } from "react";
import {
    EXAMPLE_TRASH_SCOPE,
    subscribeTrashEvents,
    type TrashEvent
} from "../../exampleActions";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

// The Trash action declares one display-only base + one Shift variant.
// Authoring lives entirely in `src/exampleActions.ts`:
//
//   variants: [{
//       when: (mods) => mods.shift,
//       label: 'Delete permanently',
//       icon: () => <FileX />,
//       execute: (event) => permanentlyDelete(event),
//   }]
//
// Open the context menu, then hold Shift — the row morphs to
// "Delete permanently" live (`useModifierState` re-renders the item).
// Click while Shift is still held: the Shift `execute` runs *without* the
// confirm dialog. Release Shift between hover and click: the base
// `executeAction` runs and the confirm dialog appears.
//
// The safety net is in `ActionManager.dispatchAction`, which re-resolves
// the variant against `event.shiftKey` at the moment of the click — so the
// label and the executed branch can never disagree.

const Example = () => {
    const [last, setLast] = useState<TrashEvent | undefined>();
    useExampleState({
        lastVariant: last?.variant ?? `none`,
        lastConfirmed: last?.confirmed ?? false
    });

    useEffect(() => subscribeTrashEvents(setLast), []);

    return (
        <div className={`flex flex-col gap-3`}>
            <div
                data-actionscope={EXAMPLE_TRASH_SCOPE}
                className={`flex h-40 items-center justify-center rounded-md border-2 border-dashed text-sm text-muted-foreground`}
            >
                Right-click. Hold Shift to switch to permanent delete.
            </div>
            <div className={`rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground`}>
                Last action:{` `}
                <code className={`font-mono`}>{last?.variant ?? `—`}</code>
                {last && (
                    <>
                        {` `}· confirmed:{` `}
                        <code className={`font-mono`}>{String(last.confirmed)}</code>
                    </>
                )}
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.globalContextMenu.modifierVariants,
    Example
};

export default module;
