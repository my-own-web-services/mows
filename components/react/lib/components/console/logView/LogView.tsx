import SearchInput from "@/components/input/searchInput/SearchInput";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import { PureComponent, type CSSProperties, type ReactNode } from "react";

export interface LogViewProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    /** The log lines to display, in arrival order. The view is purely controlled. */
    readonly lines: ReadonlyArray<string>;
    /** Hide the toolbar (search + clear). Default: false. */
    readonly hideToolbar?: boolean;
    /**
     * Invoked when the user clicks the clear button. The consumer is
     * responsible for actually emptying its lines array. If omitted, the
     * clear button is hidden.
     */
    readonly onClear?: () => void;
    /** Toolbar / state labels. */
    readonly placeholders?: {
        readonly search?: string;
        readonly clear?: string;
        readonly empty?: string;
    };
}

interface LogViewState {
    readonly search: string;
    readonly autoscroll: boolean;
}

export class LogView extends PureComponent<LogViewProps, LogViewState> {
    private scrollViewportRef: HTMLDivElement | null = null;

    state: LogViewState = {
        search: ``,
        autoscroll: true
    };

    componentDidMount = () => {
        this.scrollToBottom();
    };

    componentDidUpdate = (prevProps: LogViewProps) => {
        if (prevProps.lines !== this.props.lines && this.state.autoscroll) {
            this.scrollToBottom();
        }
    };

    scrollToBottom = () => {
        const el = this.scrollViewportRef;
        if (!el) return;
        requestAnimationFrame(() => {
            el.scrollTop = el.scrollHeight;
        });
    };

    handleScroll = () => {
        const el = this.scrollViewportRef;
        if (!el) return;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        const shouldAutoscroll = distanceFromBottom < 24;
        if (shouldAutoscroll !== this.state.autoscroll) {
            this.setState({ autoscroll: shouldAutoscroll });
        }
    };

    setScrollRef = (el: HTMLDivElement | null) => {
        this.scrollViewportRef = el;
    };

    setSearch = (search: string) => this.setState({ search });

    render = (): ReactNode => {
        const { hideToolbar, placeholders, className, style, lines, onClear } =
            this.props;
        const { search } = this.state;

        const lowerSearch = search.trim().toLowerCase();
        const filtered = lowerSearch
            ? lines.filter((line) => line.toLowerCase().includes(lowerSearch))
            : lines;

        return (
            <div
                style={style}
                className={cn(
                    `LogView flex h-full min-h-0 flex-col overflow-hidden rounded-md border bg-card font-mono text-xs`,
                    className
                )}
            >
                {!hideToolbar && (
                    <div className={`flex shrink-0 items-center gap-2 border-b p-2`}>
                        <div className={`flex-1`}>
                            <SearchInput
                                value={search}
                                onValueChange={this.setSearch}
                                placeholder={placeholders?.search ?? `Filter…`}
                            />
                        </div>
                        {onClear && (
                            <Button
                                variant={`ghost`}
                                size={`sm`}
                                onClick={onClear}
                                title={placeholders?.clear ?? `Clear log`}
                            >
                                <Trash2 className={`h-4 w-4`} />
                            </Button>
                        )}
                    </div>
                )}
                <ScrollArea
                    className={`min-h-0 flex-1`}
                    viewportRef={this.setScrollRef}
                    onScrollCapture={this.handleScroll}
                >
                    {filtered.length === 0 ? (
                        <div
                            className={`text-muted-foreground p-4 text-center text-sm`}
                        >
                            {placeholders?.empty ?? `No log lines.`}
                        </div>
                    ) : (
                        <ul className={`flex flex-col`}>
                            {filtered.map((line, i) => (
                                <li
                                    key={i}
                                    className={`text-foreground hover:bg-accent/30 px-3 py-0.5 break-words whitespace-pre-wrap`}
                                >
                                    {line}
                                </li>
                            ))}
                        </ul>
                    )}
                </ScrollArea>
            </div>
        );
    };
}

export default LogView;
