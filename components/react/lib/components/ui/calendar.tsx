import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, X } from "lucide-react";
import * as React from "react";
import {
    DayButton,
    DayPicker,
    getDefaultClassNames,
    type Matcher
} from "react-day-picker";

const YEARS_PER_PAGE = 20;

const Calendar = ({
    className,
    classNames,
    showOutsideDays = false,
    captionLayout = `label`,
    buttonVariant = `ghost`,
    formatters,
    components,
    month: monthProp,
    defaultMonth,
    onMonthChange: onMonthChangeProp,
    disabled,
    disableFuture,
    ...props
}: React.ComponentProps<typeof DayPicker> & {
    buttonVariant?: React.ComponentProps<typeof Button>[`variant`];
    disableFuture?: boolean;
}) => {
    const defaultClassNames = getDefaultClassNames();

    const today = React.useMemo(() => new Date(), []);
    const currentYear = today.getFullYear();

    const mergedDisabled = React.useMemo((): Matcher | Matcher[] | undefined => {
        const futureDisabler: Matcher | undefined = disableFuture
            ? { after: today }
            : undefined;

        if (!futureDisabler) return disabled;
        if (!disabled) return futureDisabler;
        if (Array.isArray(disabled)) return [...disabled, futureDisabler];
        return [disabled, futureDisabler];
    }, [disabled, disableFuture, today]);

    const [internalMonth, setInternalMonth] = React.useState(
        () => monthProp ?? defaultMonth ?? new Date()
    );
    const currentMonth = monthProp ?? internalMonth;

    const handleMonthChange = React.useCallback(
        (newMonth: Date) => {
            setInternalMonth(newMonth);
            onMonthChangeProp?.(newMonth);
        },
        [onMonthChangeProp]
    );

    const [yearPickerOpen, setYearPickerOpen] = React.useState(false);
    const [decadeStart, setDecadeStart] = React.useState(
        () => Math.floor(currentMonth.getFullYear() / YEARS_PER_PAGE) * YEARS_PER_PAGE
    );

    const years = React.useMemo(
        () => Array.from({ length: YEARS_PER_PAGE }, (_, i) => decadeStart + i),
        [decadeStart]
    );

    const handleYearClick = () => {
        setDecadeStart(
            Math.floor(currentMonth.getFullYear() / YEARS_PER_PAGE) * YEARS_PER_PAGE
        );
        setYearPickerOpen(true);
    };

    const handleYearSelect = (year: number) => {
        const newMonth = new Date(currentMonth);
        newMonth.setFullYear(year);
        handleMonthChange(newMonth);
        setYearPickerOpen(false);
    };

    // Close the year picker on Escape so there's a keyboard escape route
    // that doesn't change the selected year.
    React.useEffect(() => {
        if (!yearPickerOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === `Escape`) {
                e.preventDefault();
                e.stopPropagation();
                setYearPickerOpen(false);
            }
        };
        window.addEventListener(`keydown`, onKeyDown, { capture: true });
        return () =>
            window.removeEventListener(
                `keydown`,
                onKeyDown,
                { capture: true } as EventListenerOptions
            );
    }, [yearPickerOpen]);

    return (
        <div className={`relative`}>
            <DayPicker
                showOutsideDays={showOutsideDays}
                className={cn(
                    // `rounded-md` matches both the year-picker overlay
                    // below and any popover/card that wraps the calendar
                    // (Popover/Card use the same token), so the
                    // background carries the same corner radius as the
                    // surrounding chrome instead of squaring off inside
                    // a rounded wrapper.
                    `bg-background group/calendar rounded-md p-3 [--cell-size:2rem] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent`,
                    String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
                    String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
                    yearPickerOpen && `invisible`,
                    className
                )}
                captionLayout={captionLayout}
                month={currentMonth}
                onMonthChange={handleMonthChange}
                disabled={mergedDisabled}
                formatters={{
                    formatMonthDropdown: (date) =>
                        date.toLocaleString(`default`, { month: `short` }),
                    ...formatters
                }}
                classNames={{
                    root: cn(`w-fit`, defaultClassNames.root),
                    months: cn(
                        `relative flex flex-col gap-4 md:flex-row`,
                        defaultClassNames.months
                    ),
                    month: cn(`flex w-full flex-col gap-4`, defaultClassNames.month),
                    nav: cn(
                        `absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1`,
                        defaultClassNames.nav
                    ),
                    button_previous: cn(
                        buttonVariants({ variant: buttonVariant }),
                        `h-(--cell-size) w-(--cell-size) select-none p-0 aria-disabled:opacity-50`,
                        defaultClassNames.button_previous
                    ),
                    button_next: cn(
                        buttonVariants({ variant: buttonVariant }),
                        `h-(--cell-size) w-(--cell-size) select-none p-0 aria-disabled:opacity-50`,
                        defaultClassNames.button_next
                    ),
                    month_caption: cn(
                        `flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)`,
                        defaultClassNames.month_caption
                    ),
                    dropdowns: cn(
                        `flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium`,
                        defaultClassNames.dropdowns
                    ),
                    dropdown_root: cn(
                        `has-focus:border-ring border-input shadow-xs has-focus:ring-ring/50 has-focus:ring-[3px] relative rounded-md border`,
                        defaultClassNames.dropdown_root
                    ),
                    dropdown: cn(
                        `bg-popover absolute inset-0 opacity-0`,
                        defaultClassNames.dropdown
                    ),
                    caption_label: cn(
                        `relative z-10 select-none font-medium`,
                        captionLayout === `label`
                            ? `text-sm`
                            : `[&>svg]:text-muted-foreground flex h-8 items-center gap-1 rounded-md pl-2 pr-1 text-sm [&>svg]:size-3.5`,
                        defaultClassNames.caption_label
                    ),
                    weekdays: cn(`flex`, defaultClassNames.weekdays),
                    weekday: cn(
                        `text-muted-foreground flex-1 select-none rounded-md text-[0.8rem] font-normal`,
                        defaultClassNames.weekday
                    ),
                    week: cn(`mt-2 flex w-full`, defaultClassNames.week),
                    week_number_header: cn(
                        `w-(--cell-size) select-none`,
                        defaultClassNames.week_number_header
                    ),
                    week_number: cn(
                        `text-muted-foreground select-none text-[0.8rem]`,
                        defaultClassNames.week_number
                    ),
                    day: cn(
                        `group/day relative aspect-square h-full w-full select-none p-0 text-center [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md`,
                        defaultClassNames.day
                    ),
                    range_start: cn(`bg-accent rounded-l-md`, defaultClassNames.range_start),
                    range_middle: cn(`rounded-none`, defaultClassNames.range_middle),
                    range_end: cn(`bg-accent rounded-r-md`, defaultClassNames.range_end),
                    today: cn(
                        `bg-accent text-accent-foreground rounded-md data-[selected=true]:rounded-none`,
                        defaultClassNames.today
                    ),
                    outside: cn(
                        `text-muted-foreground aria-selected:text-muted-foreground`,
                        defaultClassNames.outside
                    ),
                    disabled: cn(
                        `text-muted-foreground opacity-50`,
                        defaultClassNames.disabled
                    ),
                    hidden: cn(`invisible`, defaultClassNames.hidden),
                    ...classNames
                }}
                components={{
                    Root: ({ className: rootClassName, rootRef, ...rootProps }) => {
                        return (
                            <div
                                data-slot={`calendar`}
                                ref={rootRef}
                                className={cn(rootClassName)}
                                {...rootProps}
                            />
                        );
                    },
                    Chevron: ({ className: chevClassName, orientation, ...chevProps }) => {
                        if (orientation === `left`) {
                            return (
                                <ChevronLeftIcon
                                    className={cn(`size-4`, chevClassName)}
                                    {...chevProps}
                                />
                            );
                        }

                        if (orientation === `right`) {
                            return (
                                <ChevronRightIcon
                                    className={cn(`size-4`, chevClassName)}
                                    {...chevProps}
                                />
                            );
                        }

                        return (
                            <ChevronDownIcon
                                className={cn(`size-4`, chevClassName)}
                                {...chevProps}
                            />
                        );
                    },
                    DayButton: CalendarDayButton,
                    PreviousMonthButton: CalendarNavButton,
                    NextMonthButton: CalendarNavButton,
                    WeekNumber: ({ children, ...weekProps }) => {
                        return (
                            <td {...weekProps}>
                                <div
                                    className={`flex size-(--cell-size) items-center justify-center text-center`}
                                >
                                    {children}
                                </div>
                            </td>
                        );
                    },
                    ...(captionLayout === `label` && {
                        CaptionLabel: ({
                            children,
                            className: captionClassName
                        }: {
                            children?: React.ReactNode;
                            className?: string;
                        }) => {
                            const text = String(children);
                            const yearMatch = text.match(/\d{4}/);

                            if (!yearMatch) {
                                return <span className={captionClassName}>{children}</span>;
                            }

                            const parts = text.split(/(\d{4})/);
                            return (
                                <span className={captionClassName}>
                                    {parts[0]}
                                    <button
                                        type={`button`}
                                        onPointerDown={(e) => {
                                            if (e.button === 0) {
                                                e.preventDefault();
                                                handleYearClick();
                                            }
                                        }}
                                        className={`hover:text-primary cursor-pointer font-semibold underline decoration-dotted underline-offset-4`}
                                    >
                                        {yearMatch[0]}
                                    </button>
                                    {parts[2]}
                                </span>
                            );
                        }
                    }),
                    ...components
                }}
                {...props}
            />

            {yearPickerOpen && (
                <div
                    className={`bg-popover absolute inset-0 z-10 flex flex-col items-center rounded-md p-3`}
                >
                    <div
                        className={`mb-2 flex h-(--cell-size) w-full items-center justify-between gap-1`}
                    >
                        <Button
                            type={`button`}
                            variant={`ghost`}
                            size={`icon`}
                            onPointerDown={(e) => {
                                if (e.button === 0) {
                                    e.preventDefault();
                                    setDecadeStart((d) => d - YEARS_PER_PAGE);
                                }
                            }}
                            aria-label={`Previous years`}
                            className={`h-(--cell-size) w-(--cell-size) p-0`}
                        >
                            <ChevronLeftIcon className={`size-4`} />
                        </Button>
                        <span className={`flex-1 text-center text-sm font-medium`}>
                            {decadeStart} &ndash; {decadeStart + YEARS_PER_PAGE - 1}
                        </span>
                        <Button
                            type={`button`}
                            variant={`ghost`}
                            size={`icon`}
                            onPointerDown={(e) => {
                                if (e.button === 0) {
                                    e.preventDefault();
                                    setDecadeStart((d) => d + YEARS_PER_PAGE);
                                }
                            }}
                            aria-label={`Next years`}
                            className={`h-(--cell-size) w-(--cell-size) p-0`}
                        >
                            <ChevronRightIcon className={`size-4`} />
                        </Button>
                        <Button
                            type={`button`}
                            variant={`ghost`}
                            size={`icon`}
                            onPointerDown={(e) => {
                                if (e.button === 0) {
                                    e.preventDefault();
                                    setYearPickerOpen(false);
                                }
                            }}
                            aria-label={`Close year picker`}
                            title={`Close year picker`}
                            className={`h-(--cell-size) w-(--cell-size) p-0`}
                        >
                            <X className={`size-4`} />
                        </Button>
                    </div>
                    <div className={`grid w-full flex-1 grid-cols-4 grid-rows-5 gap-1`}>
                        {years.map((year) => {
                            const isFutureYear = disableFuture && year > currentYear;

                            return (
                                <Button
                                    key={year}
                                    type={`button`}
                                    variant={
                                        year === currentMonth.getFullYear()
                                            ? `default`
                                            : `ghost`
                                    }
                                    size={`sm`}
                                    onPointerDown={(e) => {
                                        if (e.button === 0) {
                                            e.preventDefault();
                                            handleYearSelect(year);
                                        }
                                    }}
                                    disabled={isFutureYear}
                                    className={`h-full w-full text-sm`}
                                >
                                    {year}
                                </Button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

const CalendarDayButton = ({
    className,
    day,
    modifiers,
    onClick,
    ...props
}: React.ComponentProps<typeof DayButton>) => {
    const defaultClassNames = getDefaultClassNames();

    const ref = React.useRef<HTMLButtonElement>(null);
    React.useEffect(() => {
        if (modifiers.focused) ref.current?.focus();
    }, [modifiers.focused]);

    // react-day-picker calls setFocused() on pointerdown which can replace the
    // button DOM node before the browser fires the native "click" event. Move
    // the onClick handler to onPointerDown so the selection always registers.
    const handlePointerDown = React.useCallback(
        (e: React.PointerEvent<HTMLButtonElement>) => {
            if (e.button !== 0) return;
            onClick?.(e as unknown as React.MouseEvent<HTMLButtonElement>);
        },
        [onClick]
    );

    return (
        <Button
            ref={ref}
            variant={`ghost`}
            size={`icon`}
            data-day={day.date.toLocaleDateString()}
            data-selected-single={
                modifiers.selected &&
                !modifiers.range_start &&
                !modifiers.range_end &&
                !modifiers.range_middle
            }
            data-range-start={modifiers.range_start}
            data-range-end={modifiers.range_end}
            data-range-middle={modifiers.range_middle}
            className={cn(
                `data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 flex aspect-square h-auto w-full min-w-(--cell-size) flex-col gap-1 font-normal leading-none data-[range-end=true]:rounded-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] [&>span]:text-xs [&>span]:opacity-70`,
                defaultClassNames.day,
                className
            )}
            onPointerDown={handlePointerDown}
            {...props}
        />
    );
};

// `react-day-picker` v10 types `PreviousMonthButton`/`NextMonthButton` as
// plain function components returning `Element` (not `ReactNode`), so a
// `forwardRef` here trips the slot type. We don't need ref forwarding —
// rdp never asks for the underlying ref — so a plain function component
// is the right shape and the simplest fix.
const CalendarNavButton = ({
    onClick,
    children,
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
    const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
        if (e.button !== 0) return;
        e.preventDefault();
        onClick?.(e as unknown as React.MouseEvent<HTMLButtonElement>);
    };

    return (
        <button type={`button`} {...props} onPointerDown={handlePointerDown}>
            {children}
        </button>
    );
};
CalendarNavButton.displayName = `CalendarNavButton`;

export { Calendar, CalendarDayButton };
