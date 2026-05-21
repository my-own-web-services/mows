import { Bookmark, Settings, User } from "lucide-react";
import { Button } from "../../../lib/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "../../../lib/components/ui/dropdown-menu";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({});

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant={`outline`}>Open menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                    <User className={`mr-2 h-4 w-4`} />
                    Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                    <Settings className={`mr-2 h-4 w-4`} />
                    Settings
                </DropdownMenuItem>
                <DropdownMenuItem>
                    <Bookmark className={`mr-2 h-4 w-4`} />
                    Bookmarks
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.dropdownMenu.default,
    Example
};

export default module;
