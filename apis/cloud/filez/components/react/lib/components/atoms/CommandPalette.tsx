import { ActionIds } from "@/lib/defaultActions";
import type { ActionDefinition } from "@/lib/filezContext/ActionManager";
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
        if (this.context?.actionManager && !this.hotkeyRegistered) {
            this.context?.actionManager?.setHandler(ActionIds.OPEN_COMMAND_PALETTE, () => {
                this.handleOpenChange(true);
            });
            this.hotkeyRegistered = true;
        }
    };

    handleOpenChange = (open: boolean) => {
        if (this.props.onOpenChange) {
            this.props.onOpenChange(open);
        } else {
            this.setState({ internalOpen: open });
        }
    };

    executeCommand = (actionId: string) => {
        this.context?.actionManager?.dispatchAction(actionId);

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
            if (action.hideInCommandPalette) return;
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

    renderCommandItem = (action: ActionDefinition, keyPrefix: string = "") => {
        // Get all hotkeys for this action
        const hotkeys = this.context?.hotkeyManager?.getHotkeysByActionId(action.id) || [];

        const description = this.context?.t?.actions?.[action.id] || action.id;

        return (
            <CommandItem
                key={`${keyPrefix}${action.id}`}
                onSelect={() => this.executeCommand(action.id)}
                disabled={!action.handler}
            >
                <span>{description}</span>
                {hotkeys.length > 0 && (
                    <div className="ml-auto flex items-center gap-2">
                        {hotkeys.map((keyCombo, index) => (
                            <span key={index} className="flex items-center gap-2">
                                <KeyComboDisplay keyCombo={keyCombo} />
                                {index < hotkeys.length - 1 && (
                                    <span className="text-muted-foreground text-xs">|</span>
                                )}
                            </span>
                        ))}
                    </div>
                )}
            </CommandItem>
        );
    };

    render = () => {
        const open = this.props.open ?? this.state.internalOpen;
        const { t } = this.context || {};
        const commandsByCategory = this.getCommandsByCategory();
        const categories = Array.from(commandsByCategory.keys()).sort();
        const recentCommands = this.context?.actionManager?.getRecentCommands() || [];
        const recentCommandIds = new Set(recentCommands.map((cmd) => cmd.actionId));

        return (
            <CommandDialog open={open} onOpenChange={this.handleOpenChange}>
                <CommandInput placeholder={t!.commandPalette.placeholder} />
                <CommandList className="overflow-y-scroll">
                    <CommandEmpty>{t?.commandPalette?.noResults}</CommandEmpty>

                    {/* Recent Commands Section */}
                    {recentCommands.length > 0 && (
                        <CommandGroup
                            className="select-none"
                            heading={t?.commandPalette?.recentCommands}
                        >
                            {recentCommands.map((recentCmd) => {
                                const action = this.context?.actionManager?.getAction(
                                    recentCmd.actionId
                                );
                                return action ? this.renderCommandItem(action, "recent-") : null;
                            })}
                        </CommandGroup>
                    )}

                    {/* All Commands by Category */}
                    {categories.map((category) => (
                        <CommandGroup className="select-none" key={category} heading={category}>
                            {commandsByCategory
                                .get(category)!
                                .filter((action) => !recentCommandIds.has(action.id))
                                .map((action) => this.renderCommandItem(action, `${category}-`))}
                        </CommandGroup>
                    ))}
                </CommandList>
            </CommandDialog>
        );
    };
}
