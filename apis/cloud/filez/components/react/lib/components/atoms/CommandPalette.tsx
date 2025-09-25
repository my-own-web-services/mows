import type { ActionDefinition } from "@/lib/ActionManager";
import { FilezContext } from "@/main";
import { PureComponent, type CSSProperties } from "react";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "../ui/command";
import KeyComboDisplay from "./KeyComboDisplay";

interface CommandPaletteProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly open?: boolean;
    readonly onOpenChange?: (open: boolean) => void;
}

interface CommandPaletteState {
    readonly internalOpen: boolean;
}

export default class CommandPalette extends PureComponent<
    CommandPaletteProps,
    CommandPaletteState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    hotkeyRegistered: boolean = false;

    constructor(props: CommandPaletteProps) {
        super(props);
        this.state = {
            internalOpen: props.open ?? false
        };
    }

    componentDidMount = async () => {};

    componentDidUpdate = (prevProps: CommandPaletteProps) => {
        if (this.context?.hotkeyManager && !this.hotkeyRegistered) {
            this.context?.hotkeyManager?.setHandler("app.openCommandPalette", () => {
                this.handleOpenChange(true);
            });
            this.hotkeyRegistered = true;
        }
    };

    componentWillUnmount = () => {
        this.context?.hotkeyManager?.removeHandler("app.openCommandPalette");
    };

    handleOpenChange = (open: boolean) => {
        if (this.props.onOpenChange) {
            this.props.onOpenChange(open);
        } else {
            this.setState({ internalOpen: open });
        }
    };

    executeCommand = (actionId: string) => {
        const action = this.context?.hotkeyManager?.getAction(actionId);
        if (action?.handler) {
            action.handler();
        }
        this.handleOpenChange(false);
    };

    getCommandsByCategory = (): Map<string, ActionDefinition[]> => {
        const byCategory = new Map<string, ActionDefinition[]>();

        if (!this.context?.hotkeyManager) return byCategory;

        this.context.actionManager.getAllActions().forEach((action) => {
            const category = action.category;
            if (!byCategory.has(category)) {
                byCategory.set(category, []);
            }
            byCategory.get(category)!.push(action);
        });

        byCategory.forEach((actions) => {
            actions.sort((a, b) => {
                const aDesc = this.context?.t?.actions?.[a.id] || a.id;
                const bDesc = this.context?.t?.actions?.[b.id] || b.id;
                return aDesc.localeCompare(bDesc);
            });
        });

        return byCategory;
    };

    render = () => {
        const open = this.props.open ?? this.state.internalOpen;
        const { t } = this.context || {};
        const commandsByCategory = this.getCommandsByCategory();
        const categories = Array.from(commandsByCategory.keys()).sort();

        return (
            <CommandDialog open={open} onOpenChange={this.handleOpenChange}>
                <CommandInput
                    placeholder={t?.commandPalette?.placeholder || "Type a command or search..."}
                />
                <CommandList>
                    <CommandEmpty>
                        {t?.commandPalette?.noResults || "No results found."}
                    </CommandEmpty>
                    {categories.map((category) => (
                        <CommandGroup className="select-none" key={category} heading={category}>
                            {commandsByCategory.get(category)!.map((action) => {
                                // Get the first/primary hotkey for this action
                                const hotkeys = this.context?.hotkeyManager?.getHotkeysByAction(action.id) || [];
                                const primaryHotkey = hotkeys[0];
                                const currentKey = primaryHotkey 
                                    ? this.context?.hotkeyManager?.getCurrentKey(primaryHotkey.actionId, primaryHotkey.defaultKey) || ""
                                    : "";
                                const parsedKey = currentKey
                                    ? this.context?.hotkeyManager?.parseKeyCombo(currentKey) || currentKey
                                    : "";

                                const description =
                                    t?.actions?.[action.id] || action.id;

                                return (
                                    <CommandItem
                                        key={action.id}
                                        onSelect={() => this.executeCommand(action.id)}
                                    >
                                        <span>{description}</span>
                                        {parsedKey && (
                                            <KeyComboDisplay
                                                keyCombo={parsedKey}
                                                className="ml-auto"
                                            />
                                        )}
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    ))}
                </CommandList>
            </CommandDialog>
        );
    };
}
