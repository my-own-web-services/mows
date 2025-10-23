import { Action } from "@/lib/filezContext/ActionManager";
import { log } from "@/lib/logging";
import { cn } from "@/lib/utils";
import { FilezContext } from "@/main";
import { DropdownMenuTrigger } from "@radix-ui/react-dropdown-menu";
import { PureComponent, type CSSProperties } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from "../ui/dropdown-menu";
import ActionComponent from "./ActionDisplay";

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
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    constructor(props: GlobalContextMenuProps) {
        super(props);
        this.state = {
            open: false
        };
    }

    componentDidMount = async () => {
        document.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            log.debug("Document click:", event);

            // get the first parent element with the attribute data-actionscope
            const scope = (event.target as HTMLElement)
                ?.closest?.("[data-actionScope]")
                ?.getAttribute("data-actionscope");

            log.debug("Context menu element:", scope);

            if (!scope) {
                this.setState({ open: false, actions: [] });
                return;
            }

            const actions = this.context?.actionManager.getActionsByHandlerScope(scope);

            this.setState({
                open: !!actions?.length,
                actions,
                position: { x: event.pageX, y: event.pageY }
            });
        });
    };

    render = () => {
        return (
            <div
                style={{
                    ...this.props.style,
                    position: "absolute",
                    top: this.state.position?.y,
                    left: this.state.position?.x
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
                    {this.state.open && <DropdownMenuTrigger></DropdownMenuTrigger>}
                    <DropdownMenuContent align="start">
                        {this.state.actions?.map((action) => {
                            const itemState = action.getState();

                            log.debug("Rendering action in context menu:", action.id);
                            return (
                                <DropdownMenuItem
                                    key={action.id}
                                    disabled={itemState?.visibility === "disabled"}
                                    onClick={() => {
                                        this.context?.actionManager.dispatchAction(action.id);
                                        this.setState({ open: false });
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
    };
}
