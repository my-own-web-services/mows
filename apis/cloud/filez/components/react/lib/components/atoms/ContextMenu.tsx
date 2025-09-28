import { cn } from "@/lib/utils";
import { FilezContext } from "@/main";
import { type CSSProperties, type ReactNode, useContext } from "react";
import {
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuLabel,
    ContextMenu as ContextMenuRoot,
    ContextMenuSeparator,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
    ContextMenuTrigger
} from "../ui/context-menu";
import KeyComboDisplay from "./KeyComboDisplay";

// Base menu item interface
interface BaseMenuItem {
    id: string;
    label: string;
    icon?: ReactNode;
    disabled?: boolean;
    destructive?: boolean;
}

// Action menu item that triggers a function
export interface ActionMenuItem extends BaseMenuItem {
    type: "action";
    actionId?: string; // For hotkey lookup and command tracking
    onSelect: () => void;
}

// Submenu item that contains other menu items
export interface SubMenuItem extends BaseMenuItem {
    type: "submenu";
    items: MenuItem[];
}

// Separator item
export interface SeparatorMenuItem {
    type: "separator";
    id: string;
}

// Label item for section headers
export interface LabelMenuItem {
    type: "label";
    id: string;
    label: string;
}

// Union type for all menu item types
export type MenuItem = ActionMenuItem | SubMenuItem | SeparatorMenuItem | LabelMenuItem;

interface ContextMenuProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly children: ReactNode;
    readonly items: MenuItem[];
    readonly disabled?: boolean;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
    className,
    style,
    children,
    items,
    disabled = false,
    ...props
}) => {
    const context = useContext(FilezContext);

    const handleItemSelect = (item: ActionMenuItem) => {
        if (!item.disabled) {
            item.onSelect();
        }
    };

    const getHotkeyDisplay = (actionId?: string) => {
        if (!actionId || !context?.hotkeyManager) return null;

        const hotkeyDisplays = context.hotkeyManager.getHotkeysByActionId(actionId) || [];

        if (hotkeyDisplays.length === 0) return null;

        return (
            <div className="ml-auto flex items-center gap-1">
                {hotkeyDisplays.map((keyCombo, index) => (
                    <span key={index} className="flex items-center gap-1">
                        <KeyComboDisplay keyCombo={keyCombo} className="scale-75" />
                        {index < hotkeyDisplays.length - 1 && (
                            <span className="text-muted-foreground text-xs">|</span>
                        )}
                    </span>
                ))}
            </div>
        );
    };

    const renderMenuItem = (item: MenuItem): ReactNode => {
        switch (item.type) {
            case "separator":
                return <ContextMenuSeparator key={item.id} />;

            case "label":
                return <ContextMenuLabel key={item.id}>{item.label}</ContextMenuLabel>;

            case "action":
                return (
                    <ContextMenuItem
                        key={item.id}
                        onSelect={() => handleItemSelect(item)}
                        disabled={item.disabled}
                        className={cn(
                            "flex cursor-pointer items-center gap-2",
                            item.destructive && "text-destructive focus:text-destructive",
                            item.disabled && "cursor-not-allowed opacity-50"
                        )}
                    >
                        {item.icon && (
                            <span className="flex h-4 w-4 items-center justify-center">
                                {item.icon}
                            </span>
                        )}
                        <span className="flex-1">{item.label}</span>
                        {getHotkeyDisplay(item.actionId)}
                    </ContextMenuItem>
                );

            case "submenu":
                return (
                    <ContextMenuSub key={item.id}>
                        <ContextMenuSubTrigger
                            disabled={item.disabled}
                            className={cn(
                                "flex items-center gap-2",
                                item.destructive && "text-destructive",
                                item.disabled && "opacity-50"
                            )}
                        >
                            {item.icon && (
                                <span className="flex h-4 w-4 items-center justify-center">
                                    {item.icon}
                                </span>
                            )}
                            <span>{item.label}</span>
                        </ContextMenuSubTrigger>
                        <ContextMenuSubContent className="min-w-[180px]">
                            {item.items.map(renderMenuItem)}
                        </ContextMenuSubContent>
                    </ContextMenuSub>
                );

            default:
                return null;
        }
    };

    if (disabled) {
        return (
            <div className={className} style={style} {...props}>
                {children}
            </div>
        );
    }

    return (
        <ContextMenuRoot>
            <ContextMenuTrigger asChild>
                <div className={className} style={style} {...props}>
                    {children}
                </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="min-w-[180px]">
                {items.map(renderMenuItem)}
            </ContextMenuContent>
        </ContextMenuRoot>
    );
};

ContextMenu.displayName = "ContextMenu";

export default ContextMenu;
