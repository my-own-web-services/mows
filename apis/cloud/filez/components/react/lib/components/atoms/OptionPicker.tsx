import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { PureComponent, type CSSProperties, type ReactNode } from "react";

export interface OptionItem {
    readonly id: string;
    readonly label: string;
    readonly enabled: boolean;
}

interface OptionPickerProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly options: readonly OptionItem[];
    readonly onOptionChange: (id: string, enabled: boolean) => void;
    readonly triggerComponent?: ReactNode;
    readonly disabled?: boolean;
    readonly showCount?: boolean;
    readonly header?: ReactNode;
}

interface OptionPickerState {
    readonly open: boolean;
}

export default class OptionPicker extends PureComponent<OptionPickerProps, OptionPickerState> {
    constructor(props: OptionPickerProps) {
        super(props);
        this.state = {
            open: false
        };
    }

    componentDidMount = async () => {};

    handleOpenChange = (open: boolean) => {
        this.setState({ open });
    };

    handleOptionToggle = (id: string, enabled: boolean) => {
        this.props.onOptionChange(id, enabled);
    };

    render = () => {
        const {
            options,
            triggerComponent: trigger = "Options",
            disabled = false,
            showCount = true,
            header
        } = this.props;
        const enabledCount = options.filter((option) => option.enabled).length;
        const totalCount = options.length;

        return (
            <DropdownMenu open={this.state.open} onOpenChange={this.handleOpenChange}>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="icon"
                        disabled={disabled}
                        size={"icon"}
                        style={{ ...this.props.style }}
                        className={cn(
                            "OptionPicker flex cursor-pointer items-center justify-between",
                            this.props.className
                        )}
                    >
                        <span className="flex w-full items-center justify-center">
                            {trigger}
                            {showCount && (
                                <span className="text-muted-foreground ml-2">
                                    ({enabledCount}/{totalCount})
                                </span>
                            )}
                        </span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    {header && (
                        <>
                            <DropdownMenuLabel>{header}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                        </>
                    )}
                    {options.map((option) => (
                        <DropdownMenuCheckboxItem
                            key={option.id}
                            className="cursor-pointer"
                            checked={option.enabled}
                            onCheckedChange={(checked) =>
                                this.handleOptionToggle(option.id, checked || false)
                            }
                            onSelect={(event) => {
                                event.preventDefault();
                            }}
                        >
                            {option.label}
                        </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        );
    };
}
