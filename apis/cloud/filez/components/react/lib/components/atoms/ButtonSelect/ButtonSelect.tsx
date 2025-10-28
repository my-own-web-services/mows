import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PureComponent, type CSSProperties, type ReactNode } from "react";

export interface ButtonSelectOption {
    readonly id: string;
    readonly icon: ReactNode;
    readonly label?: string;
    readonly disabled?: boolean;
}

interface ButtonSelectProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly options: readonly ButtonSelectOption[];
    readonly selectedId?: string;
    readonly onSelectionChange: (id: string) => void;
    readonly disabled?: boolean;
    readonly size?: `sm` | `lg` | `icon-sm` | `icon` | `icon-lg` | `default`;
}

type ButtonSelectState = Record<string, never>;

export default class ButtonSelect extends PureComponent<ButtonSelectProps, ButtonSelectState> {
    constructor(props: ButtonSelectProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    handleOptionClick = (id: string) => {
        if (this.props.disabled) return;

        this.props.onSelectionChange(id);
    };

    render = () => {
        const { options, selectedId, disabled = false, size = `sm` } = this.props;

        return (
            <div
                style={{ ...this.props.style }}
                className={cn(`ButtonSelect inline-flex rounded-md`, this.props.className)}
                role={`group`}
                aria-label={`Button group`}
            >
                {options.map((option, index) => (
                    <Button
                        key={option.id}
                        variant={`outline`}
                        size={size}
                        disabled={disabled || option.disabled}
                        onClick={() => this.handleOptionClick(option.id)}
                        className={cn(
                            `rounded-none border-r-0 transition-all duration-200 focus:z-10`,
                            index === 0 && `rounded-l-md`,
                            index === options.length - 1 && `rounded-r-md border-r`,
                            selectedId === option.id && `bg-accent`
                        )}
                        title={option.label}
                        aria-pressed={selectedId === option.id}
                    >
                        {option.icon}
                    </Button>
                ))}
            </div>
        );
    };
}
