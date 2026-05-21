import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { log } from "@/lib/logging";
import { Action, ActionVisibility } from "@/lib/mowsContext/ActionManager";
import { MowsContext } from "@/lib/mowsContext/MowsContext";
import { cn } from "@/lib/utils";
import { DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu";
import { PureComponent, type CSSProperties } from "react";
import ActionComponent from "@/components/actions/actionDisplay/ActionDisplay";

interface GlobalContextMenuProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface GlobalContextMenuState {
    readonly open: boolean;
    readonly actions?: Action[];
    readonly position?: { x: number; y: number };
}

export default class GlobalContextMenu extends PureComponent<
    GlobalContextMenuProps,
    GlobalContextMenuState
> {
    static contextType = MowsContext;
    declare context: React.ContextType<typeof MowsContext>;

    constructor(props: GlobalContextMenuProps) {
        super(props);
        this.state = {
            open: false
        };
    }

    componentDidMount = () => {
        document.addEventListener(`contextmenu`, this.handleContextMenu);
    };

    componentWillUnmount = () => {
        document.removeEventListener(`contextmenu`, this.handleContextMenu);
    };

    handleContextMenu = (event: MouseEvent) => {
        const scope = (event.target as HTMLElement | null)
            ?.closest?.(`[data-actionscope]`)
            ?.getAttribute(`data-actionscope`);

        log.debug(`Context menu element:`, scope);

        if (!scope) {
            if (this.state.open) this.setState({ open: false, actions: [] });
            return;
        }

        const actions = this.context?.actionManager.getActionsByHandlerScope(scope);
        if (!actions?.length) {
            if (this.state.open) this.setState({ open: false, actions: [] });
            return;
        }

        // Only suppress the native context menu when we will actually show ours,
        // and use viewport coordinates so the menu opens exactly under the cursor
        // regardless of scroll or positioned ancestors.
        event.preventDefault();
        this.setState({
            open: true,
            actions,
            position: { x: event.clientX, y: event.clientY }
        });
    };

    render = () => (
        <div
            style={{
                ...this.props.style,
                position: `fixed`,
                top: this.state.position?.y ?? 0,
                left: this.state.position?.x ?? 0,
                width: 0,
                height: 0
            }}
            className={cn(`ContextMenu`, this.props.className)}
        >
            <DropdownMenu
                modal={false}
                open={this.state.open}
                onOpenChange={(open) => {
                    this.setState({ open });
                }}
            >
                {this.state.open && (
                    <DropdownMenuTrigger asChild>
                        <span
                            aria-hidden
                            style={{ display: `block`, width: 0, height: 0 }}
                        />
                    </DropdownMenuTrigger>
                )}
                <DropdownMenuContent
                    align={`start`}
                    side={`bottom`}
                    sideOffset={0}
                    avoidCollisions={false}
                    // Strip all open/close animations so the menu appears
                    // pinned exactly at the cursor with no slide/fade offset.
                    className={`!animate-none !duration-0 !data-[state=open]:animate-none !data-[state=closed]:animate-none !data-[state=open]:slide-in-from-top-0 !data-[state=open]:zoom-in-100 !data-[state=open]:fade-in-100 !data-[state=closed]:fade-out-100 !data-[state=closed]:zoom-out-100 !transition-none`}
                >
                    {this.state.actions?.map((action) => {
                        const itemState = action.getState();
                        const disabled = itemState?.visibility === ActionVisibility.Disabled;
                        const trigger = () => {
                            this.context?.actionManager.dispatchAction(action.id);
                            this.setState({ open: false });
                        };

                        log.debug(`Rendering action in context menu:`, action.id);
                        return (
                            <DropdownMenuItem
                                className={`cursor-pointer`}
                                key={action.id}
                                disabled={disabled}
                                onClick={trigger}
                                onContextMenu={(e) => {
                                    // A right-click inside our menu should behave like
                                    // a left-click — dispatch the action and prevent the
                                    // browser's native context menu from showing. We also
                                    // stop propagation so the document-level handler does
                                    // not run and tear the menu down.
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (disabled) return;
                                    trigger();
                                }}
                            >
                                <ActionComponent action={action} />
                            </DropdownMenuItem>
                        );
                    })}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
