import { PureComponent } from "react";
import { FilezContext } from "../../lib/filezContext/FilezContext";
import { Logger } from "../../lib/logging";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import LogLevelSlider from "./LogLevelSlider";

type LogLevel = `TRACE` | `DEBUG` | `INFO` | `WARN` | `ERROR`;

interface LoggingConfigProps {
    className?: string;
}

interface LoggingConfigState {
    defaultLevel: LogLevel;
    fileFilters: Record<string, LogLevel>;
    newFilePattern: string;
    newFileLevel: LogLevel;
}

export default class LoggingConfig extends PureComponent<LoggingConfigProps, LoggingConfigState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: LoggingConfigProps) {
        super(props);
        this.state = {
            defaultLevel: Logger.defaultLevel,
            fileFilters: { ...Logger.fileFilter },
            newFilePattern: ``,
            newFileLevel: `DEBUG`
        };
    }

    private handleDefaultLevelChange = (level: LogLevel): void => {
        Logger.defaultLevel = level;
        Logger.saveConfig();
        this.setState({ defaultLevel: level });
    };

    private handleAddFileFilter = (): void => {
        const { newFilePattern, newFileLevel } = this.state;
        if (!newFilePattern.trim()) return;

        Logger.fileFilter[newFilePattern] = newFileLevel;
        Logger.saveConfig();
        this.setState({
            fileFilters: { ...Logger.fileFilter },
            newFilePattern: ``
        });
    };

    private handleRemoveFileFilter = (filePattern: string): void => {
        delete Logger.fileFilter[filePattern];
        Logger.saveConfig();
        this.setState({ fileFilters: { ...Logger.fileFilter } });
    };

    private handleFileFilterLevelChange = (filePattern: string, level: LogLevel): void => {
        Logger.fileFilter[filePattern] = level;
        Logger.saveConfig();
        this.setState({ fileFilters: { ...Logger.fileFilter } });
    };

    private handleNewFilePatternChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        this.setState({ newFilePattern: e.target.value });
    };

    private handleNewFileLevelChange = (level: LogLevel): void => {
        this.setState({ newFileLevel: level });
    };

    render = () => {
        const { t } = this.context!;
        const { defaultLevel, fileFilters, newFilePattern, newFileLevel } = this.state;

        return (
            <div className={this.props.className}>
                <Card>
                    <CardHeader>
                        <CardTitle>{t.loggingConfig.title}</CardTitle>
                        <CardDescription>{t.loggingConfig.description}</CardDescription>
                    </CardHeader>
                    <CardContent className={`space-y-6`}>
                        {/* Default Log Level */}
                        <div className={`space-y-3`}>
                            <Label>{t.loggingConfig.defaultLevel}</Label>
                            <LogLevelSlider
                                value={defaultLevel}
                                onChange={this.handleDefaultLevelChange}
                            />
                        </div>

                        {/* File Filters */}
                        <div className={`space-y-3`}>
                            <Label>{t.loggingConfig.fileFilters}</Label>
                            <div className={`space-y-2`}>
                                {Object.entries(fileFilters).length === 0 ? (
                                    <p className={`text-muted-foreground text-sm`}>
                                        {t.loggingConfig.noFileFilters}
                                    </p>
                                ) : (
                                    Object.entries(fileFilters).map(([filePattern, level]) => (
                                        <div
                                            key={filePattern}
                                            className={`bg-card space-y-3 rounded-md border p-3`}
                                        >
                                            <div className={`flex items-center justify-between`}>
                                                <span className={`font-mono text-sm font-semibold`}>
                                                    {filePattern}
                                                </span>
                                                <Button
                                                    variant={`ghost`}
                                                    size={`sm`}
                                                    onClick={() =>
                                                        this.handleRemoveFileFilter(filePattern)
                                                    }
                                                >
                                                    {t.loggingConfig.remove}
                                                </Button>
                                            </div>
                                            <LogLevelSlider
                                                value={level}
                                                onChange={(newLevel) =>
                                                    this.handleFileFilterLevelChange(filePattern, newLevel)
                                                }
                                            />
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Add New File Filter */}
                            <div className={`space-y-2 pt-2`}>
                                <Label>{t.loggingConfig.addFileFilter}</Label>
                                <div className={`flex items-center gap-2`}>
                                    <Input
                                        placeholder={t.loggingConfig.filePatternPlaceholder}
                                        value={newFilePattern}
                                        onChange={this.handleNewFilePatternChange}
                                        onKeyDown={(e) => {
                                            if (e.key === `Enter`) {
                                                this.handleAddFileFilter();
                                            }
                                        }}
                                        className={`flex-1`}
                                    />
                                    <LogLevelSlider
                                        value={newFileLevel}
                                        onChange={this.handleNewFileLevelChange}
                                        className={`w-52`}
                                    />
                                    <Button
                                        onClick={this.handleAddFileFilter}
                                        size={`sm`}
                                        className={`flex-shrink-0`}
                                    >
                                        {t.loggingConfig.add}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    };
}
