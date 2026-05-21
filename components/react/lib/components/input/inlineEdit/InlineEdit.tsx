import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Pencil, X } from "lucide-react";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent as ReactKeyboardEvent
} from "react";

export interface InlineEditProps {
    /** Current value. The component is controlled. */
    readonly value: string;
    /**
     * Fired when the user commits a non-empty, changed value (Enter or blur).
     * Empty or unchanged values are silently discarded.
     */
    readonly onCommit: (next: string) => void | Promise<void>;
    /** Optional placeholder shown when `value` is empty (display mode). */
    readonly placeholder?: string;
    /** Disable editing. The text still renders. */
    readonly disabled?: boolean;
    /** Override the rendered tag — defaults to a span so it stays inline. */
    readonly as?: keyof Pick<HTMLElementTagNameMap,
        `span` | `h1` | `h2` | `h3` | `h4` | `h5` | `h6`>;
    /** Aria-label for the underlying editable region. */
    readonly ariaLabel?: string;
    readonly className?: string;
    readonly style?: CSSProperties;
    /** Aria-label for the Edit affordance button. */
    readonly editAriaLabel?: string;
    /** Aria-label for the Save affordance button. */
    readonly saveAriaLabel?: string;
    /** Aria-label for the Cancel affordance button. */
    readonly cancelAriaLabel?: string;
    /**
     * Lock the editor surface to a fixed width. Accepts any CSS length
     * (px, rem, %, ch, …) or a raw number (interpreted as px). When set,
     * the contentEditable element no longer grows with the typed value —
     * overflow is clipped horizontally and the caret scrolls within the
     * fixed box, so the surrounding layout never reflows.
     *
     * Defaults to `undefined` — the editor sizes to its content (legacy
     * behaviour). Set this for hero / heading-style placements where a
     * predictable row width matters more than seeing the full value.
     */
    readonly width?: number | string;
}

const SLOT_SIZE = `h-6 w-6`;
// Two SLOT_SIZE slots side-by-side, no gap. Exposed as a single token so
// the affordance container width can never drift from the slot count.
const AFFORDANCE_WIDTH = `w-12`;

/**
 * InlineEdit — edit text in place without changing the surrounding layout.
 *
 * Uses a `contentEditable` element so the text never gets swapped for an
 * `<input>`. The affordance column is a *fixed-width* grid: every action
 * button is always rendered into a stable 24x24 slot and toggled with
 * opacity, so the row's width is identical in idle, hover, and editing
 * states.
 */
const InlineEdit = ({
    value,
    onCommit,
    placeholder,
    disabled = false,
    as: Tag = `span`,
    ariaLabel,
    className,
    style,
    editAriaLabel = `Edit`,
    saveAriaLabel = `Save`,
    cancelAriaLabel = `Cancel`,
    width
}: InlineEditProps) => {
    const ref = useRef<HTMLElement | null>(null);
    const [editing, setEditing] = useState(false);

    // Mirror the controlled `value` into the contentEditable element whenever
    // we are NOT actively editing. Doing it during editing would move the
    // caret on every keystroke.
    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        if (!editing && element.textContent !== value) {
            element.textContent = value;
        }
        // Leaving edit mode: reset horizontal scroll so display always
        // shows the start of the value. The browser would otherwise keep
        // the caret-driven scrollLeft from editing, causing the text to
        // appear "cut off on the left" once the user clicks away.
        if (!editing) {
            element.scrollLeft = 0;
        }
    }, [value, editing]);

    const selectAll = useCallback(() => {
        const element = ref.current;
        if (!element) return;
        const range = document.createRange();
        range.selectNodeContents(element);
        const sel = window.getSelection();
        if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }, []);

    const focusAndSelect = useCallback(() => {
        const element = ref.current;
        if (!element) return;
        element.focus();
        selectAll();
    }, [selectAll]);

    const commit = useCallback(async () => {
        const element = ref.current;
        if (!element) return;
        const next = (element.textContent ?? ``).trim();
        setEditing(false);
        if (!next || next === value) {
            // Restore the previous value visually.
            element.textContent = value;
            return;
        }
        await onCommit(next);
    }, [onCommit, value]);

    const cancel = useCallback(() => {
        const element = ref.current;
        if (element) {
            element.textContent = value;
            element.blur();
        }
        setEditing(false);
    }, [value]);

    const onKeyDown = useCallback(
        (e: ReactKeyboardEvent<HTMLElement>) => {
            if (e.key === `Enter`) {
                e.preventDefault();
                // Blur to trigger commit via onBlur (single commit path).
                ref.current?.blur();
            } else if (e.key === `Escape`) {
                e.preventDefault();
                cancel();
            }
        },
        [cancel]
    );

    // The JSX intrinsic-element union produced by `keyof JSX.IntrinsicElements`
    // exceeds TypeScript's union-complexity limit when the consuming
    // `<Component>` JSX expression is type-checked (TS2590). The
    // narrower `React.ElementType<HTMLAttributes<HTMLElement>>` doesn't
    // escape TS2590 at the JSX call site, so we widen to plain
    // `React.ElementType` — still typed (no `any`), still rejects
    // non-renderable values, just doesn't pin the attribute shape.
    const Component = Tag as React.ElementType;

    // Slot button base — every action button is absolutely positioned inside
    // its slot so its visibility cannot influence the slot's own footprint.
    // shadcn `Button` would otherwise enforce `h-9 w-9` for size="icon"; we
    // override to `absolute inset-0` so the button fills its parent slot.
    const slotButtonBase = cn(
        `absolute inset-0 h-auto w-auto p-0 rounded-md`,
        `transition-opacity`
    );

    // Three logical visibility states per button:
    //   pencil  — shown only in idle+hover, never in editing
    //   check   — shown only in editing
    //   cancel  — shown only in editing
    const showPencil = !disabled && !editing;
    const showCheck = !disabled && editing;
    const showCancel = !disabled && editing;

    return (
        <span
            className={cn(
                `group/inline-edit relative inline-flex items-center gap-2`,
                className
            )}
            style={style}
        >
            {/* The editable surface. contentEditable stays on whenever the
                component is enabled — so clicking anywhere on the text
                lands the caret naturally and enters edit mode via focus,
                without swapping in an <input> that would shift layout. */}
            <Component
                ref={ref as never}
                role={`textbox`}
                aria-label={ariaLabel}
                aria-readonly={disabled}
                contentEditable={!disabled}
                suppressContentEditableWarning
                spellCheck={false}
                onFocus={() => {
                    if (!disabled) setEditing(true);
                }}
                onKeyDown={onKeyDown}
                onBlur={() => {
                    if (editing) commit();
                }}
                className={cn(
                    `min-w-[1ch] rounded-md outline-none transition-colors`,
                    // Always reserve the same 1px border + offsetting margin
                    // so the layout doesn't shift between idle / hover /
                    // editing. The editing ring is a box-shadow (ring-2)
                    // and so adds no layout.
                    `border border-transparent px-1 -mx-1`,
                    // When `width` is set, the contentEditable must NOT
                    // expand with typed content. Clip overflow and force
                    // a single line so the caret scrolls horizontally
                    // inside the fixed box. The ellipsis is only useful
                    // in display mode — in editing mode it would mask the
                    // text the user is actively writing.
                    width !== undefined && `block overflow-hidden whitespace-nowrap`,
                    width !== undefined && !editing && `text-ellipsis`,
                    !disabled && `cursor-text`,
                    !disabled && !editing &&
                        `group-hover/inline-edit:border-muted-foreground/50`,
                    editing && `border-primary ring-primary/40 ring-2`,
                    !value && !editing &&
                        `text-muted-foreground italic before:content-[attr(data-placeholder)]`
                )}
                data-placeholder={placeholder}
                style={
                    width !== undefined
                        ? { width: typeof width === `number` ? `${width}px` : width }
                        : undefined
                }
            />
            {/* Fixed-width affordance column. Two 24x24 slots, regardless of
                state, with all three buttons mounted at all times and
                positioned absolutely inside their slots. The opacity +
                pointer-events toggles do the visual swap without ever
                changing the row's geometry. */}
            {!disabled && (
                <span
                    aria-hidden={false}
                    className={cn(
                        `relative grid grid-cols-2 flex-none items-center`,
                        AFFORDANCE_WIDTH
                    )}
                >
                    <span className={cn(`relative`, SLOT_SIZE)}>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label={editAriaLabel}
                            tabIndex={showPencil ? 0 : -1}
                            aria-hidden={!showPencil}
                            // onMouseDown (before focus) so the pencil click
                            // doesn't blur-then-refocus the editor.
                            onMouseDown={(e) => {
                                e.preventDefault();
                                focusAndSelect();
                            }}
                            className={cn(
                                slotButtonBase,
                                `text-muted-foreground hover:text-foreground`,
                                // Visible only in idle+hover. The opacity
                                // transition keeps the same DOM node so the
                                // row never reflows.
                                showPencil
                                    ? `opacity-0 group-hover/inline-edit:opacity-100`
                                    : `opacity-0 pointer-events-none`
                            )}
                        >
                            <Pencil className="size-3" aria-hidden />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label={saveAriaLabel}
                            tabIndex={showCheck ? 0 : -1}
                            aria-hidden={!showCheck}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                commit();
                            }}
                            className={cn(
                                slotButtonBase,
                                `text-emerald-500`,
                                showCheck ? `opacity-100` : `opacity-0 pointer-events-none`
                            )}
                        >
                            <Check className="size-3.5" aria-hidden />
                        </Button>
                    </span>
                    <span className={cn(`relative`, SLOT_SIZE)}>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label={cancelAriaLabel}
                            tabIndex={showCancel ? 0 : -1}
                            aria-hidden={!showCancel}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                cancel();
                            }}
                            className={cn(
                                slotButtonBase,
                                `text-muted-foreground hover:text-destructive`,
                                showCancel ? `opacity-100` : `opacity-0 pointer-events-none`
                            )}
                        >
                            <X className="size-3.5" aria-hidden />
                        </Button>
                    </span>
                </span>
            )}
        </span>
    );
};

export default InlineEdit;
