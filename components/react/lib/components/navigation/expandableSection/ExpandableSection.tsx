import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import {
    useCallback,
    useState,
    type CSSProperties,
    type ReactNode
} from "react";

export interface ExpandableSectionProps {
    /**
     * Always-visible header row rendered inside the trigger button. The
     * component owns the chevron — your header should NOT include one.
     */
    readonly header: ReactNode;
    /** Body revealed when the section is open. */
    readonly children?: ReactNode;
    /** Initial open state when uncontrolled. Defaults to `false`. */
    readonly defaultOpen?: boolean;
    /** Controlled open state. */
    readonly open?: boolean;
    /** Fires whenever the disclosure toggles. */
    readonly onOpenChange?: (open: boolean) => void;
    /**
     * When true, the trigger is non-interactive and the chevron is
     * hidden. Use this when the section currently has no body content
     * to reveal — clicking the header would otherwise produce an empty
     * expansion. Defaults to `false`.
     */
    readonly disabled?: boolean;
    /**
     * Accessible label for the disclosure when collapsed. Surfaced as
     * the trigger's `aria-label`.
     */
    readonly expandLabel?: string;
    /**
     * Accessible label for the disclosure when expanded. Surfaced as
     * the trigger's `aria-label`.
     */
    readonly collapseLabel?: string;
    /**
     * Replace the chevron glyph entirely. Pass `null` / `false` to hide
     * it (kept available for cases where the consumer wants to render a
     * custom affordance inside the header).
     */
    readonly chevron?: ReactNode;
    /** Extra class names on the outer `<Collapsible>` wrapper. */
    readonly className?: string;
    /** Extra class names on the trigger button row. */
    readonly triggerClassName?: string;
    /** Extra class names on the inner body wrapper that owns the top border. */
    readonly contentClassName?: string;
    readonly style?: CSSProperties;
    /** `data-testid` forwarded to the outer wrapper. */
    readonly testId?: string;
}

/**
 * ExpandableSection — styled `<Collapsible>` wrapper with a header row
 * on the left and an auto-rotating chevron on the right. Ported from
 * the `ExpandableSection` helper inside `omniviv/web/src/components/
 * PlacesPanel.tsx`, which uses one shared visual treatment for every
 * expandable card in a panel (hours, weather, events, …) so that the
 * panel reads as a coherent stack.
 *
 *   ┌─────────────────────────────────────────────┐
 *   │ <header>                                  ▽ │  ← always visible
 *   ├─────────────────────────────────────────────┤  ← top border
 *   │ <children>                                  │  ← only when open
 *   └─────────────────────────────────────────────┘
 *
 * Compose it for any kind of disclosed content — the wrapper doesn't
 * know or care what's inside. Controlled via `open` / `onOpenChange`,
 * or uncontrolled via `defaultOpen`. When the section currently has
 * nothing to reveal pass `disabled` so the trigger becomes inert and
 * the chevron disappears — clicking an empty section is the worst
 * possible UX and the omniviv reference avoids it implicitly by not
 * rendering the section at all.
 */
export const ExpandableSection = ({
    header,
    children,
    defaultOpen = false,
    open,
    onOpenChange,
    disabled = false,
    expandLabel,
    collapseLabel,
    chevron,
    className,
    triggerClassName,
    contentClassName,
    style,
    testId
}: ExpandableSectionProps) => {
    const isControlled = open !== undefined;
    const [internalOpen, setInternalOpen] = useState(defaultOpen);
    const rawIsOpen = isControlled ? open : internalOpen;
    // A disabled section is always reported as collapsed so disclosure
    // affordances downstream of the data attribute stay consistent.
    const isOpen = disabled ? false : rawIsOpen;

    const handleOpenChange = useCallback(
        (next: boolean) => {
            if (disabled) return;
            if (!isControlled) setInternalOpen(next);
            onOpenChange?.(next);
        },
        [disabled, isControlled, onOpenChange]
    );

    const showChevron = !disabled && chevron !== null && chevron !== false;
    const resolvedChevron =
        chevron === undefined || chevron === true ? (
            <ChevronDown
                className={`text-muted-foreground h-3.5 w-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-180`}
                aria-hidden
            />
        ) : (
            chevron
        );

    return (
        <Collapsible
            open={isOpen}
            onOpenChange={handleOpenChange}
            className={cn(
                `ExpandableSection group bg-muted/50 overflow-hidden rounded-md`,
                className
            )}
            data-testid={testId}
            data-disabled={disabled || undefined}
            style={style}
        >
            <CollapsibleTrigger
                disabled={disabled}
                aria-label={
                    disabled ? undefined : isOpen ? collapseLabel : expandLabel
                }
                data-testid={
                    testId !== undefined ? `${testId}-trigger` : undefined
                }
                className={cn(
                    `flex w-full items-center gap-2 px-3 py-2 text-left transition-colors`,
                    !disabled && `hover:bg-muted/70 cursor-pointer`,
                    disabled && `cursor-default`,
                    triggerClassName
                )}
            >
                <div className={`min-w-0 flex-1`}>{header}</div>
                {showChevron ? resolvedChevron : null}
            </CollapsibleTrigger>
            {children !== undefined && children !== null ? (
                <CollapsibleContent>
                    <div
                        className={cn(
                            `border-border/50 border-t`,
                            contentClassName
                        )}
                        data-testid={
                            testId !== undefined ? `${testId}-body` : undefined
                        }
                    >
                        {children}
                    </div>
                </CollapsibleContent>
            ) : null}
        </Collapsible>
    );
};

export default ExpandableSection;
