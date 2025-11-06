import { FilezContext } from "@/lib/filezContext/FilezContext";
import { ActionIds } from "@/lib/defaultActions";
import type { Action } from "@/lib/filezContext/ActionManager";
import { ActionVisibility } from "@/lib/filezContext/ActionManager";
import { log } from "@/lib/logging";
import { PureComponent, type CSSProperties } from "react";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "../../ui/command";
import ActionComponent from "../actionDisplay/ActionDisplay";

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

    constructor(props: CommandPaletteProps) {
        super(props);
        this.state = {
            internalOpen: props.open ?? false
        };
    }

    componentDidMount = async () => {
        log.debug(`CommandPalette mounted:`, this.props);
        this.registerActionHandler();
    };

    componentDidUpdate = (_prevProps: CommandPaletteProps) => {
        log.debug(`CommandPalette props updated:`, this.props);

        this.registerActionHandler();
    };

    componentWillUnmount = () => {
        this.context?.actionManager?.unregisterActionHandler(
            ActionIds.OPEN_COMMAND_PALETTE,
            `GlobalCommandPalette`
        );
    };

    registerActionHandler = () => {
        this.context?.actionManager?.registerActionHandler(ActionIds.OPEN_COMMAND_PALETTE, {
            executeAction: () => {
                this.handleOpenChange(true);
            },

            id: `GlobalCommandPalette`,
            getState: () => ({ visibility: ActionVisibility.Shown })
        });
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

    getCommandsByCategory = (): Map<string, Action[]> => {
        const byCategory = new Map<string, Action[]>();

        if (!this.context?.hotkeyManager) return byCategory;

        Array.from(this.context.actionManager.getAllActions().values()).forEach((action) => {
            const category = action.category;
            if (!byCategory.has(category)) {
                byCategory.set(category, []);
            }
            if (action.hideInCommandPalette) return;
            if (action.getState()?.visibility === ActionVisibility.Hidden) return;
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

    renderCommandItem = (action: Action, keyPrefix: string = ``) => {
        const itemState = action.getState();
        return (
            <CommandItem
                key={`${keyPrefix}${action.id}`}
                onSelect={() => this.executeCommand(action.id)}
                disabled={itemState?.visibility === ActionVisibility.Disabled}
            >
                <ActionComponent action={action} />
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

        log.debug(`Rendering CommandPalette:`, {
            open,
            recentCommands,
            categories,
            commandsByCategory
        });

        return (
            <CommandDialog open={open} onOpenChange={this.handleOpenChange}>
                <CommandInput placeholder={t!.commandPalette.placeholder} />
                <CommandList className={`overflow-y-scroll`}>
                    <CommandEmpty>{t?.commandPalette?.noResults}</CommandEmpty>

                    {/* Recent Commands Section */}
                    {recentCommands.length > 0 && (
                        <CommandGroup
                            className={`select-none`}
                            heading={t?.commandPalette?.recentCommands}
                        >
                            {recentCommands.map((recentCmd) => {
                                const action = this.context?.actionManager?.getAction(
                                    recentCmd.actionId
                                );
                                return action ? this.renderCommandItem(action, `recent-`) : null;
                            })}
                        </CommandGroup>
                    )}

                    {/* All Commands by Category */}
                    {categories
                        .filter((category) => {
                            const categoryActions = commandsByCategory
                                .get(category)!
                                .filter((action) => !recentCommandIds.has(action.id));
                            return categoryActions.length > 0;
                        })
                        .map((category) => (
                            <CommandGroup
                                className={`select-none`}
                                key={category}
                                heading={category}
                            >
                                {commandsByCategory
                                    .get(category)!
                                    .filter((action) => !recentCommandIds.has(action.id))
                                    .map((action) =>
                                        this.renderCommandItem(action, `${category}-`)
                                    )}
                            </CommandGroup>
                        ))}
                </CommandList>
            </CommandDialog>
        );
    };
}
