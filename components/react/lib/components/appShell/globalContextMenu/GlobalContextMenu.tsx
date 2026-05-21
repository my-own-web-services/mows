import ActionComponent from "@/components/actions/actionDisplay/ActionDisplay";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger
} from "@/components/ui/dropdown-menu";
import { log } from "@/lib/logging";
import {
    Action,
    ActionVisibility,
    resolveAction,
    type ResolvedAction
} from "@/lib/mowsContext/ActionManager";
import { MowsContext } from "@/lib/mowsContext/MowsContext";
import { useModifierState } from "@/lib/mowsContext/ModifierState";
import { cn } from "@/lib/utils";
import { DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu";
import { PureComponent, useContext, type CSSProperties, type MouseEvent } from "react";

interface GlobalContextMenuProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface GlobalContextMenuState {
    readonly open: boolean;
    readonly actions?: Action[];
    readonly position?: { x: number; y: number };
}

/**
 * Single recursive renderer for one entry in the global context menu.
 *
 * Subscribes to the live modifier mask so visible labels / icons / disabled
 * state morph instantly while Shift, Alt, Ctrl or Meta are held. The
 * *executed* behaviour is re-resolved from the click event itself, so a
 * Shift-down → Shift-up race can never silently invoke a destructive
 * variant.
 */
const ContextMenuActionItem = ({
    action,
    onDispatched
}: {
    action: Action;
    onDispatched: () => void;
}) => {
    const mods = useModifierState();
    const ctx = useContext(MowsContext);
    const resolved: ResolvedAction = resolveAction(action, mods);

    if (resolved.visibility === ActionVisibility.Hidden) return null;
    const disabled = resolved.visibility === ActionVisibility.Disabled;

    const dispatch = (event: MouseEvent<HTMLElement>) => {
        ctx?.actionManager.dispatchAction(action.id, event.nativeEvent);
        onDispatched();
    };

    if (resolved.children.length > 0) {
        return (
            <DropdownMenuSub>
                <DropdownMenuSubTrigger
                    className={`cursor-pointer`}
                    disabled={disabled}
                >
                    <ActionComponent action={action} resolved={resolved} />
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                    {resolved.children.map((child) => (
                        <ContextMenuActionItem
                            key={child.id}
                            action={
                                ctx?.actionManager.getAction(child.id) ??
                                // Children resolver returned an Action that
                                // isn't registered globally — render it
                                // directly from the resolved snapshot so the
                                // user still sees the entry.
                                ({ id: child.id, category: child.category } as Action)
                            }
                            onDispatched={onDispatched}
                        />
                    ))}
                </DropdownMenuSubContent>
            </DropdownMenuSub>
        );
    }

    return (
        <DropdownMenuItem
            className={`cursor-pointer`}
            disabled={disabled}
            onClick={dispatch}
            onContextMenu={(event) => {
                // Right-click inside our menu behaves like a left-click:
                // dispatch and swallow the browser's native menu + the
                // document-level handler that would otherwise tear ours down.
                event.preventDefault();
                event.stopPropagation();
                if (disabled) return;
                dispatch(event);
            }}
        >
            <ActionComponent action={action} resolved={resolved} />
        </DropdownMenuItem>
    );
};

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

    close = () => this.setState({ open: false });

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
                    {this.state.actions?.map((action) => (
                        <ContextMenuActionItem
                            key={action.id}
                            action={action}
                            onDispatched={this.close}
                        />
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
