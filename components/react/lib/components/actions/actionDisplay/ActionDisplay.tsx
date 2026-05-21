import { MowsContext } from "@/lib/mowsContext/MowsContext";
import { Action, type ResolvedAction } from "@/lib/mowsContext/ActionManager";
import { cn } from "@/lib/utils";
import { PureComponent, type CSSProperties } from "react";
import KeyComboDisplay from "../keyComboDisplay/KeyComboDisplay";

interface ActionDisplayProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly action: Action;
    /**
     * Optional pre-resolved snapshot. When provided, its `label` / `icon` /
     * `component` / `disabledReasonText` override the action's default
     * state — letting modifier-variant menus morph the visible row without
     * the display having to know about variants itself. Falls back to
     * `action.getState()` when absent.
     */
    readonly resolved?: ResolvedAction;
}

type ActionDisplayState = Record<string, never>;

export default class ActionDisplay extends PureComponent<ActionDisplayProps, ActionDisplayState> {
    static contextType = MowsContext;
    declare context: React.ContextType<typeof MowsContext>;

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
                <span
                    title={itemState?.disabledReasonText || undefined}
                    className={`flex items-center gap-2`}
                >
                    {itemState.component?.() ?? (
                        <>
                            {itemState.icon && (
                                <span
                                    className={`text-current [&>svg]:size-4 [&>svg]:shrink-0`}
                                    aria-hidden
                                >
                                    {itemState.icon()}
                                </span>
                            )}
                            <span>{description}</span>
                        </>
                    )}
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
