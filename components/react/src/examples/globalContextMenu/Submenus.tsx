import { EXAMPLE_SHARE_SCOPE } from "../../exampleActions";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

// To turn a context-menu entry into a submenu, register an `ActionHandler`
// whose `children` resolver returns the sub-`Action[]`. `GlobalContextMenu`
// will render a `<DropdownMenuSub>` automatically — you only declare data,
// the menu component picks the right shadcn primitive based on whether the
// resolved action has children.
//
// See `src/exampleActions.ts` for the registration. The Share parent
// references three leaf actions defined just above it; each is also
// addressable independently from the command palette.

const Example = () => {
    useExampleState({ scope: EXAMPLE_SHARE_SCOPE });

    return (
        <div
            data-actionscope={EXAMPLE_SHARE_SCOPE}
            className={`flex h-40 items-center justify-center rounded-md border-2 border-dashed text-sm text-muted-foreground`}
        >
            Right-click — Share opens a submenu.
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.globalContextMenu.submenus,
    Example
};

export default module;
