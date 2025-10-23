import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FilezContext } from "@/lib/filezContext/FilezContext";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown, Folder } from "lucide-react";
import { PureComponent, type CSSProperties, type ReactNode } from "react";
import { FileGroup } from "filez-client-typescript";

interface FileGroupPickerProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly value?: FileGroup;
    readonly onValueChange?: (value?: FileGroup) => void;
    readonly getFileGroups?: () => Promise<FileGroup[] | undefined>;
    readonly disabled?: boolean;
    readonly placeholder?: string;
    readonly triggerComponent?: ReactNode;
    readonly standalone?: boolean;
    readonly autofocus?: boolean;
}

interface FileGroupPickerState {
    readonly open: boolean;
    readonly fileGroups: FileGroup[];
    readonly loading: boolean;
    readonly error: string | null;
}

export default class FileGroupPicker extends PureComponent<
    FileGroupPickerProps,
    FileGroupPickerState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: FileGroupPickerProps) {
        super(props);
        this.state = {
            open: false,
            fileGroups: [],
            loading: false,
            error: null
        };
    }

    componentDidMount = async () => {
        await this.loadFileGroups();
    };

    componentDidUpdate = async (prevProps: FileGroupPickerProps) => {
        if (this.props.getFileGroups !== prevProps.getFileGroups) {
            await this.loadFileGroups();
        }
    };

    loadFileGroups = async () => {
        this.setState({ loading: true, error: null });

        try {
            let groups: FileGroup[] | undefined;

            if (this.props.getFileGroups) {
                groups = await this.props.getFileGroups();
            } else {
                // Handle API request ourselves when no prop is provided
                const res = await this.context?.filezClient.api.listFileGroups({});
                groups = res?.data?.data?.file_groups;
            }

            const fileGroups = groups || [];

            this.setState({
                fileGroups,
                loading: false,
                error: null
            });

            // Auto-select if only one option and no current selection
            if (fileGroups.length === 1 && !this.props.value) {
                this.props.onValueChange?.(fileGroups[0]);
            }
        } catch (error) {
            this.setState({
                fileGroups: [],
                loading: false,
                error: error instanceof Error ? error.message : "Failed to load file groups"
            });
        }
    };

    handleOpenChange = (open: boolean) => {
        this.setState({ open });
        if (open && this.state.fileGroups.length === 0) {
            this.loadFileGroups();
        }

        // Auto-select if only one option when opening the picker
        if (open && this.state.fileGroups.length === 1 && !this.props.value) {
            this.props.onValueChange?.(this.state.fileGroups[0]);
            this.setState({ open: false }); // Close the picker since selection is made
        }
    };

    handleSelect = (fileGroup: FileGroup) => {
        this.setState({ open: false });
        this.props.onValueChange?.(fileGroup);
    };

    filterFileGroups = (value: string, search: string) => {
        const fileGroup = this.state.fileGroups.find((group) => group.id === value);
        if (!fileGroup) return 0;

        const searchLower = search.toLowerCase();
        const nameMatch = fileGroup.name.toLowerCase().includes(searchLower);
        const idMatch = fileGroup.id.toLowerCase().includes(searchLower);

        return nameMatch || idMatch ? 1 : 0;
    };

    renderContent = () => {
        const { value, placeholder, autofocus = false } = this.props;
        const { fileGroups, loading, error } = this.state;
        const { t } = this.context!;

        const displayPlaceholder = placeholder || t.fileGroupPicker.selectFileGroup;

        if (loading) {
            return (
                <div className="py-6 text-center text-sm">
                    {t.fileGroupPicker.loading}
                </div>
            );
        }

        if (error) {
            return (
                <div className="py-6 text-center text-sm text-destructive">
                    {error}
                </div>
            );
        }

        return (
            <Command filter={this.filterFileGroups}>
                <CommandInput
                    placeholder={displayPlaceholder}
                    autoFocus={autofocus}
                />
                <CommandList>
                    <CommandEmpty className="py-6 text-center text-sm select-none">
                        {t.fileGroupPicker.noFileGroupFound}
                    </CommandEmpty>
                    <CommandGroup>
                        {fileGroups.map((fileGroup) => (
                            <CommandItem
                                key={fileGroup.id}
                                value={fileGroup.id}
                                className="cursor-pointer"
                                onSelect={() => this.handleSelect(fileGroup)}
                            >
                                <div className="flex items-center gap-2">
                                    <Folder className="h-4 w-4" />
                                    <div className="flex flex-col">
                                        <span className="font-medium">
                                            {fileGroup.name}
                                        </span>
                                        <span className="text-muted-foreground text-xs">
                                            {fileGroup.id}
                                        </span>
                                    </div>
                                </div>
                                <Check
                                    className={cn(
                                        "ml-auto h-4 w-4",
                                        value?.id === fileGroup.id
                                            ? "opacity-100"
                                            : "opacity-0"
                                    )}
                                />
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </CommandList>
            </Command>
        );
    };

    render = () => {
        const {
            className,
            style,
            value,
            placeholder,
            triggerComponent,
            disabled = false,
            standalone = false
        } = this.props;
        const { open } = this.state;
        const { t } = this.context!;

        const displayPlaceholder = placeholder || t.fileGroupPicker.selectFileGroup;

        // If standalone (used in modal), render the command directly without popover
        if (standalone) {
            return (
                <div className={cn(className, "w-full")} style={style}>
                    {this.renderContent()}
                </div>
            );
        }

        return (
            <Popover modal open={open} onOpenChange={this.handleOpenChange}>
                <PopoverTrigger asChild>
                    <div
                        className={cn(
                            className,
                            "flex w-full cursor-pointer items-center justify-between px-3 py-2 border rounded-md",
                            disabled && "pointer-events-none cursor-not-allowed opacity-50"
                        )}
                        style={style}
                        title={displayPlaceholder}
                    >
                        {triggerComponent || (
                            <>
                                <div className="flex items-center gap-2">
                                    <Folder className="h-4 w-4" />
                                    {value ? (
                                        <div className="flex flex-col">
                                            <span className="font-medium">
                                                {value.name}
                                            </span>
                                            <span className="text-muted-foreground text-xs">
                                                {value.id}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground">
                                            {displayPlaceholder}
                                        </span>
                                    )}
                                </div>
                                <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                            </>
                        )}
                    </div>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                    {this.renderContent()}
                </PopoverContent>
            </Popover>
        );
    };
}
