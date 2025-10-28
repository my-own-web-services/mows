import { PureComponent } from "react";
import { cn } from "../../lib/utils";
import { Slider } from "../ui/slider";

type LogLevel = `TRACE` | `DEBUG` | `INFO` | `WARN` | `ERROR`;

interface LogLevelSliderProps {
    value: LogLevel;
    onChange: (level: LogLevel) => void;
    className?: string;
}

export default class LogLevelSlider extends PureComponent<LogLevelSliderProps> {
    private logLevels: LogLevel[] = [`TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`];

    private getLevelIndex = (level: LogLevel): number => {
        return this.logLevels.indexOf(level);
    };

    private getLevelFromIndex = (index: number): LogLevel => {
        return this.logLevels[index];
    };

    private handleChange = (value: number[]): void => {
        const level = this.getLevelFromIndex(value[0]);
        this.props.onChange(level);
    };

    private getLevelColor = (level: LogLevel): string => {
        switch (level) {
            case `TRACE`:
                return `text-cyan-500`;
            case `DEBUG`:
                return `text-blue-500`;
            case `INFO`:
                return `text-lime-500`;
            case `WARN`:
                return `text-yellow-500`;
            case `ERROR`:
                return `text-red-500`;
        }
    };

    render = () => {
        const { value, className } = this.props;
        const selectedIndex = this.getLevelIndex(value);

        return (
            <div className={className}>
                <Slider
                    value={[selectedIndex]}
                    onValueChange={this.handleChange}
                    min={0}
                    max={4}
                    step={1}
                />
                <div className={`flex justify-between px-1 pt-1 text-xs`}>
                    {this.logLevels.map((level, index) => (
                        <span
                            key={level}
                            className={cn(
                                `transition-colors`,
                                index === selectedIndex
                                    ? this.getLevelColor(level)
                                    : `text-muted-foreground`
                            )}
                        >
                            {level}
                        </span>
                    ))}
                </div>
            </div>
        );
    };
}
