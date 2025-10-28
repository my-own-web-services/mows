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
import { cn, formatFileSizeToHumanReadable } from "@/lib/utils";
import { StorageQuota } from "filez-client-typescript";
import { Check, ChevronsUpDown, Database } from "lucide-react";
import { PureComponent, type CSSProperties, type ReactNode } from "react";

interface StorageQuotaPickerProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly value?: StorageQuota;
    readonly onValueChange?: (value?: StorageQuota) => void;
    readonly getStorageQuotas?: () => Promise<StorageQuota[] | undefined>;
    readonly disabled?: boolean;
    readonly placeholder?: string;
    readonly triggerComponent?: ReactNode;
    readonly standalone?: boolean;
    readonly autofocus?: boolean;
}

interface StorageQuotaPickerState {
    readonly open: boolean;
    readonly storageQuotas: StorageQuota[];
    readonly loading: boolean;
    readonly error: string | null;
}

export default class StorageQuotaPicker extends PureComponent<
    StorageQuotaPickerProps,
    StorageQuotaPickerState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: StorageQuotaPickerProps) {
        super(props);
        this.state = {
            open: false,
            storageQuotas: [],
            loading: false,
            error: null
        };
    }

    componentDidMount = async () => {
        await this.loadStorageQuotas();
    };

    componentDidUpdate = async (prevProps: StorageQuotaPickerProps) => {
        if (this.props.getStorageQuotas !== prevProps.getStorageQuotas) {
            await this.loadStorageQuotas();
        }
    };

    loadStorageQuotas = async () => {
        this.setState({ loading: true, error: null });

        try {
            let quotas: StorageQuota[] | undefined;

            if (this.props.getStorageQuotas) {
                quotas = await this.props.getStorageQuotas();
            } else {
                // Handle API request ourselves when no prop is provided
                const res = await this.context?.filezClient.api.listStorageQuotas({});
                quotas = res?.data?.data?.storage_quotas;
            }

            const storageQuotas = quotas || [];

            this.setState({
                storageQuotas,
                loading: false,
                error: null
            });

            // Auto-select if only one option and no current selection
            if (storageQuotas.length === 1 && !this.props.value) {
                this.props.onValueChange?.(storageQuotas[0]);
            }
        } catch (error) {
            this.setState({
                storageQuotas: [],
                loading: false,
                error: error instanceof Error ? error.message : `Failed to load storage quotas`
            });
        }
    };

    handleOpenChange = (open: boolean) => {
        this.setState({ open });
        if (open && this.state.storageQuotas.length === 0) {
            this.loadStorageQuotas();
        }

        // Auto-select if only one option when opening the picker
        if (open && this.state.storageQuotas.length === 1 && !this.props.value) {
            this.props.onValueChange?.(this.state.storageQuotas[0]);
            this.setState({ open: false }); // Close the picker since selection is made
        }
    };

    handleSelect = (quota: StorageQuota) => {
        this.setState({ open: false });
        this.props.onValueChange?.(quota);
    };

    filterStorageQuotas = (value: string, search: string) => {
        const quota = this.state.storageQuotas.find((quota) => quota.id === value);
        if (!quota) return 0;

        const searchLower = search.toLowerCase();
        const nameMatch = quota.name.toLowerCase().includes(searchLower);
        const idMatch = quota.id.toLowerCase().includes(searchLower);

        return nameMatch || idMatch ? 1 : 0;
    };

    renderContent = () => {
        const { value, placeholder, autofocus = false } = this.props;
        const { storageQuotas, loading, error } = this.state;
        const { t } = this.context!;

        const displayPlaceholder = placeholder || t.storageQuotaPicker.selectStorageQuota;

        if (loading) {
            return <div className={`py-6 text-center text-sm`}>{t.storageQuotaPicker.loading}</div>;
        }

        if (error) {
            return <div className={`text-destructive py-6 text-center text-sm`}>{error}</div>;
        }

        return (
            <Command filter={this.filterStorageQuotas}>
                <CommandInput placeholder={displayPlaceholder} autoFocus={autofocus} />
                <CommandList>
                    <CommandEmpty className={`py-6 text-center text-sm select-none`}>
                        {t.storageQuotaPicker.noStorageQuotaFound}
                    </CommandEmpty>
                    <CommandGroup>
                        {storageQuotas.map((quota) => (
                            <CommandItem
                                key={quota.id}
                                value={quota.id}
                                className={`cursor-pointer`}
                                onSelect={() => this.handleSelect(quota)}
                            >
                                <div className={`flex items-center gap-2`}>
                                    <Database className={`h-4 w-4`} />
                                    <div className={`flex flex-col`}>
                                        <span className={`font-medium`}>{quota.name}</span>
                                        <div className={`text-muted-foreground flex items-center gap-2 text-xs`}>
                                            <span>{quota.id}</span>
                                            <span>
                                                {formatFileSizeToHumanReadable(quota.quota_bytes)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <Check
                                    className={cn(
                                        `ml-auto h-4 w-4`,
                                        value?.id === quota.id ? `opacity-100` : `opacity-0`
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

        const displayPlaceholder = placeholder || t.storageQuotaPicker.selectStorageQuota;

        // If standalone (used in modal), render the command directly without popover
        if (standalone) {
            return (
                <div className={cn(className, `w-full`)} style={style}>
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
                            `flex h-10 max-w-[400px] cursor-pointer items-center justify-between rounded-md border px-3 py-2`,
                            disabled && `pointer-events-none cursor-not-allowed opacity-50`
                        )}
                        style={style}
                        title={value ? `${value.name} (${value.id}) - ${formatFileSizeToHumanReadable(value.quota_bytes)}` : displayPlaceholder}
                    >
                        {triggerComponent || (
                            <>
                                <div className={`flex min-w-0 items-center gap-2 overflow-hidden`}>
                                    <Database className={`h-4 w-4 flex-shrink-0`} />
                                    {value ? (
                                        <div className={`min-w-0 flex-1 truncate`}>
                                            <span className={`font-medium truncate`}>{value.name}</span>
                                            <span className={`text-muted-foreground ml-2 text-xs`}>
                                                ({formatFileSizeToHumanReadable(value.quota_bytes)})
                                            </span>
                                        </div>
                                    ) : (
                                        <span className={`text-muted-foreground truncate`}>
                                            {displayPlaceholder}
                                        </span>
                                    )}
                                </div>
                                <ChevronsUpDown className={`ml-2 h-4 w-4 flex-shrink-0 opacity-50`} />
                            </>
                        )}
                    </div>
                </PopoverTrigger>
                <PopoverContent className={`w-[400px] p-0`}>{this.renderContent()}</PopoverContent>
            </Popover>
        );
    };
}
