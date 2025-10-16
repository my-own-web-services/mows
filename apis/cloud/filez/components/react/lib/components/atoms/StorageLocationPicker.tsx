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
import { Check, ChevronsUpDown, HardDrive } from "lucide-react";
import { PureComponent, type CSSProperties, type ReactNode } from "react";
import { StorageLocationListItem } from "filez-client-typescript";

interface StorageLocationPickerProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly value?: StorageLocationListItem;
    readonly onValueChange?: (value?: StorageLocationListItem) => void;
    readonly getStorageLocations?: () => Promise<StorageLocationListItem[] | undefined>;
    readonly disabled?: boolean;
    readonly placeholder?: string;
    readonly triggerComponent?: ReactNode;
    readonly standalone?: boolean;
    readonly autofocus?: boolean;
}

interface StorageLocationPickerState {
    readonly open: boolean;
    readonly storageLocations: StorageLocationListItem[];
    readonly loading: boolean;
    readonly error: string | null;
}

export default class StorageLocationPicker extends PureComponent<
    StorageLocationPickerProps,
    StorageLocationPickerState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: StorageLocationPickerProps) {
        super(props);
        this.state = {
            open: false,
            storageLocations: [],
            loading: false,
            error: null
        };
    }

    componentDidMount = async () => {
        await this.loadStorageLocations();
    };

    componentDidUpdate = async (prevProps: StorageLocationPickerProps) => {
        if (this.props.getStorageLocations !== prevProps.getStorageLocations) {
            await this.loadStorageLocations();
        }
    };

    loadStorageLocations = async () => {
        this.setState({ loading: true, error: null });

        try {
            let locations: StorageLocationListItem[] | undefined;

            if (this.props.getStorageLocations) {
                locations = await this.props.getStorageLocations();
            } else {
                // Handle API request ourselves when no prop is provided
                const res = await this.context?.filezClient.api.listStorageLocations({});
                locations = res?.data?.data?.storage_locations;
            }

            const storageLocations = locations || [];

            this.setState({
                storageLocations,
                loading: false,
                error: null
            });

            // Auto-select if only one option and no current selection
            if (storageLocations.length === 1 && !this.props.value) {
                this.props.onValueChange?.(storageLocations[0]);
            }
        } catch (error) {
            this.setState({
                storageLocations: [],
                loading: false,
                error: error instanceof Error ? error.message : "Failed to load storage locations"
            });
        }
    };

    handleOpenChange = (open: boolean) => {
        this.setState({ open });
        if (open && this.state.storageLocations.length === 0) {
            this.loadStorageLocations();
        }

        // Auto-select if only one option when opening the picker
        if (open && this.state.storageLocations.length === 1 && !this.props.value) {
            this.props.onValueChange?.(this.state.storageLocations[0]);
            this.setState({ open: false }); // Close the picker since selection is made
        }
    };

    handleSelect = (location: StorageLocationListItem) => {
        this.setState({ open: false });
        this.props.onValueChange?.(location);
    };

    filterStorageLocations = (value: string, search: string) => {
        const location = this.state.storageLocations.find((loc) => loc.id === value);
        if (!location) return 0;

        const searchLower = search.toLowerCase();
        const nameMatch = location.name.toLowerCase().includes(searchLower);
        const idMatch = location.id.toLowerCase().includes(searchLower);

        return nameMatch || idMatch ? 1 : 0;
    };

    renderContent = () => {
        const { value, placeholder, autofocus = false } = this.props;
        const { storageLocations, loading, error } = this.state;
        const { t } = this.context!;

        const displayPlaceholder = placeholder || t.storageLocationPicker.selectStorageLocation;

        if (loading) {
            return (
                <div className="py-6 text-center text-sm">
                    {t.storageLocationPicker.loading}
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
            <Command filter={this.filterStorageLocations}>
                <CommandInput
                    placeholder={displayPlaceholder}
                    autoFocus={autofocus}
                />
                <CommandList>
                    <CommandEmpty className="py-6 text-center text-sm select-none">
                        {t.storageLocationPicker.noStorageLocationFound}
                    </CommandEmpty>
                    <CommandGroup>
                        {storageLocations.map((location) => (
                            <CommandItem
                                key={location.id}
                                value={location.id}
                                className="cursor-pointer"
                                onSelect={() => this.handleSelect(location)}
                            >
                                <div className="flex items-center gap-2">
                                    <HardDrive className="h-4 w-4" />
                                    <div className="flex flex-col">
                                        <span className="font-medium">
                                            {location.name}
                                        </span>
                                        <span className="text-muted-foreground text-xs">
                                            {location.id}
                                        </span>
                                    </div>
                                </div>
                                <Check
                                    className={cn(
                                        "ml-auto h-4 w-4",
                                        value?.id === location.id
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

        const displayPlaceholder = placeholder || t.storageLocationPicker.selectStorageLocation;

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
                                    <HardDrive className="h-4 w-4" />
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