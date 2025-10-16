import { log } from "@/lib/logging";
import { cn } from "@/lib/utils";
import { FilezContext } from "@/main";
import { PureComponent, type CSSProperties } from "react";
import { ContextMenu, ContextMenuContent } from "../ui/context-menu";

interface GlobalContextMenuProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface GlobalContextMenuState {
    readonly open: boolean;
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

            // get the first pararent element with the attribute data-actionScope
            const contextMenuElement = (event.target as HTMLElement).closest(
                "[data-actionScope]"
            ) as HTMLElement;
            log.debug("Context menu element:", contextMenuElement.getAttribute("data-actionScope"));

            // Collect all actions until some defined data-actionScopeLimit

            this.setState({ open: true });
        });
    };

    render = () => {
        return (
            <div
                style={{ ...this.props.style }}
                className={cn(`ContextMenu`, this.props.className)}
            >
                {this.state.open && (
                    <ContextMenu>
                        <ContextMenuContent></ContextMenuContent>
                    </ContextMenu>
                )}
            </div>
        );
    };
}
