import { Action } from "@/lib/filezContext/ActionManager";
import { cn } from "@/lib/utils";
import { FilezContext } from "@/main";
import { PureComponent, type CSSProperties } from "react";
import KeyComboDisplay from "../keyComboDisplay/KeyComboDisplay";

interface ActionDisplayProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly action: Action;
}

type ActionDisplayState = Record<string, never>;

export default class ActionDisplay extends PureComponent<ActionDisplayProps, ActionDisplayState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: ActionDisplayProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        const { action } = this.props;
        const hotkeys = this.context?.hotkeyManager?.getHotkeysByActionId(action.id) || [];

        const description = this.context?.t?.actions?.[action.id] || action.id;

        const itemState = action.getState();
        return (
            <span
                style={{ ...this.props.style }}
                className={cn(
                    `ActionDisplay`,
                    `flex w-full justify-between gap-2`,
                    this.props.className
                )}
            >
                <span title={itemState?.disabledReasonText || undefined}>
                    {itemState.component?.() || description}
                </span>
                {hotkeys.length > 0 && (
                    <div className={`ml-auto flex items-center gap-2`}>
                        {hotkeys.map((keyCombo, index) => (
                            <span key={index} className={`flex items-center gap-2`}>
                                <KeyComboDisplay keyCombo={keyCombo} />
                                {index < hotkeys.length - 1 && (
                                    <span className={`text-muted-foreground text-xs`}>|</span>
                                )}
                            </span>
                        ))}
                    </div>
                )}
            </span>
        );
    };
}
