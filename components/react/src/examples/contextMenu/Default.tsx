import { Check } from "lucide-react";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger
} from "../../../lib/components/ui/context-menu";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({});

    return (
        <ContextMenu>
            <ContextMenuTrigger
                className={`flex h-32 w-full items-center justify-center rounded-md border-2 border-dashed text-sm text-muted-foreground`}
            >
                Right-click anywhere in this box
            </ContextMenuTrigger>
            <ContextMenuContent>
                <ContextMenuItem>
                    <Check className={`mr-2 h-4 w-4`} />
                    Mark as read
                </ContextMenuItem>
                <ContextMenuItem>Reply</ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem>Delete</ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.contextMenu.default,
    Example
};

export default module;
