import { Clock } from "lucide-react";
import {
    useContext,
    useEffect,
    useMemo,
    useState,
    type CSSProperties,
    type ReactNode
} from "react";
import { cn } from "@/lib/utils";
import { MowsContext } from "@/lib/mowsContext/MowsContext";
import ExpandableSection from "../../navigation/expandableSection/ExpandableSection";
import {
    buildOpeningHoursStatus,
    buildOpeningHoursWeek,
    parseOsmOpeningHours,
    resolveOpeningHoursStrings,
    type OpeningHoursSchedule,
    type OpeningHoursStatus,
    type OpeningHoursStrings,
    type OpeningHoursTone,
    type OpeningHoursVariant,
    type OpeningHoursWeek
} from "./types";

export interface OpeningHoursProps {
    /**
     * Raw OSM `opening_hours` tag value, e.g.
     * `Mo-Fr 09:00-18:00; Sa 10:00-14:00`. Mutually exclusive with
     * `schedule`. When the value is empty or unparsable the component
     * renders nothing — match the behaviour of the OSM data itself.
     */
    readonly rules?: string | null;
    /**
     * Pre-parsed schedule. Pass when you want to keep the parser out
     * of the render path (SSR, batched lists, tests). Mutually
     * exclusive with `rules`; when both are supplied, `schedule`
     * wins.
     */
    readonly schedule?: OpeningHoursSchedule;
    /**
     * Reference moment for "open/closed", "closing soon", and the
     * highlighted day. Defaults to a live `Date` that ticks once a
     * minute; pass a fixed `Date` for deterministic snapshots.
     */
    readonly now?: Date;
    /**
     * IETF BCP 47 locale used for weekday names and `HH:mm`
     * formatting. When omitted, the component reads
     * `MowsContext.currentLanguage.code` and falls back to the
     * browser locale (`Intl` default) when no provider is present.
     * The same locale also selects the bundled translation when
     * `strings` is not passed.
     */
    readonly locale?: string;
    /** First column of the week table. Defaults to `monday`. */
    readonly weekStart?: `monday` | `sunday`;
    /**
     * Visual variant. `full` shows status + table, `status` only the
     * one-line status, `week` only the table, `inline` flows the
     * status into surrounding prose without the clock icon.
     */
    readonly variant?: OpeningHoursVariant;
    /**
     * When `variant="full"`, hide the week table behind a disclosure and
     * promote the status line to the always-visible trigger. The status
     * is the only thing most readers actually want to see, so collapsing
     * the table by default keeps surrounding panels from being shoved
     * below the fold. Set to `false` to keep the table inline at all
     * times. Has no effect on the `status`, `week`, and `inline`
     * variants — those only render one half and have nothing to
     * disclose. Defaults to `true`.
     */
    readonly collapsible?: boolean;
    /**
     * Initial open state of the disclosure when `collapsible` is on.
     * Defaults to `false` (status visible, table hidden). Ignored when
     * `collapsible` is `false` or `variant !== "full"`.
     */
    readonly defaultOpen?: boolean;
    /**
     * Translation overrides. Layered on top of the locale-resolved
     * bundle (English / German built-in; other locales fall back to
     * English). Override a single field or pass a full set — anything
     * you provide wins.
     */
    readonly strings?: Partial<OpeningHoursStrings>;
    /**
     * Optional override for the tone → className map. Provide when
     * you want to opt out of the built-in `text-emerald-…` /
     * `text-amber-…` palette and align with your own design tokens.
     */
    readonly toneClassName?: Readonly<Record<OpeningHoursTone, string>>;
    /** Slot rendered after the status line; useful for badges. */
    readonly trailing?: ReactNode;
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly "data-testid"?: string;
}

const DEFAULT_TONE_CLASS: Readonly<Record<OpeningHoursTone, string>> = {
    open: `text-emerald-600 dark:text-emerald-400`,
    closingSoon: `text-amber-600 dark:text-amber-400`,
    closed: `text-muted-foreground`
};

const StatusLine = ({
    status,
    toneClass,
    trailing,
    showIcon
}: {
    readonly status: OpeningHoursStatus;
    readonly toneClass: Readonly<Record<OpeningHoursTone, string>>;
    readonly trailing?: ReactNode;
    readonly showIcon: boolean;
}) => {
    const tone = toneClass[status.tone];
    return (
        <div className={`flex items-center gap-2 text-sm`}>
            {showIcon ? (
                <Clock className={cn(`h-3.5 w-3.5 shrink-0`, tone)} aria-hidden />
            ) : null}
            <span className={`flex flex-wrap items-baseline gap-x-1`}>
                <span className={cn(`font-medium`, tone)}>{status.headline}</span>
                {status.detail ? (
                    <span className={`text-muted-foreground`}> · {status.detail}</span>
                ) : null}
            </span>
            {trailing}
        </div>
    );
};

const WeekTable = ({
    week,
    closedDayLabel,
    scheduleLabel
}: {
    readonly week: OpeningHoursWeek;
    readonly closedDayLabel: string;
    readonly scheduleLabel: string;
}) => {
    if (week.length === 0) return null;
    return (
        <table
            className={`w-full text-xs tabular-nums border-collapse`}
            aria-label={scheduleLabel}
        >
            <tbody>
                {week.map((day) => (
                    <tr
                        key={day.label}
                        className={cn(
                            `border-b border-border/50 last:border-b-0`,
                            day.isToday && `bg-muted font-medium`
                        )}
                        data-today={day.isToday ? `true` : undefined}
                    >
                        <th
                            scope={`row`}
                            className={`text-left align-top px-3 py-1 font-normal text-muted-foreground w-12`}
                            title={day.longLabel}
                        >
                            {day.label}
                        </th>
                        <td className={`align-top px-3 py-1`}>
                            {day.intervals.length > 0 ? (
                                day.intervals
                                    .map((iv) => `${iv.fromLabel}–${iv.toLabel}`)
                                    .join(`, `)
                            ) : (
                                <span className={`text-muted-foreground`}>{closedDayLabel}</span>
                            )}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

const useMinuteTicker = (enabled: boolean) => {
    const [tick, setTick] = useState(0);
    useEffect(() => {
        if (!enabled) return;
        // Align the first tick to the start of the next minute so the
        // status flips at the same instant the wall clock crosses 00s
        // rather than drifting by up to 59 seconds.
        const now = new Date();
        const msToNextMinute = 60000 - (now.getTime() % 60000);
        let interval: ReturnType<typeof setInterval> | null = null;
        const timeout = setTimeout(() => {
            setTick((n) => n + 1);
            interval = setInterval(() => setTick((n) => n + 1), 60000);
        }, msToNextMinute);
        return () => {
            clearTimeout(timeout);
            if (interval) clearInterval(interval);
        };
    }, [enabled]);
    return tick;
};

/**
 * Display opening hours from an OSM `opening_hours` tag (or any
 * compatible string) as a live status pill plus a 7-day schedule
 * table. The status auto-refreshes once a minute when `now` is
 * derived internally; pass a fixed `now` for SSR / tests / lists
 * where ticking would be wasteful.
 *
 * The component is presentational: it renders nothing when `rules`
 * is empty or unparsable so callers can drop it into a section
 * unconditionally without "no opening hours" placeholders.
 */
export const OpeningHours = ({
    rules,
    schedule,
    now,
    locale,
    weekStart = `monday`,
    variant = `full`,
    collapsible = true,
    defaultOpen = false,
    strings,
    toneClassName,
    trailing,
    className,
    style,
    "data-testid": dataTestId
}: OpeningHoursProps) => {
    // Optional `MowsContext` — present when the component is mounted
    // inside `<MowsProvider>`, absent when the component is used
    // standalone. Lets us derive a sensible `locale` + bundled
    // translation without forcing every caller to thread the language
    // through their own props.
    const mowsContext = useContext(MowsContext);
    const contextLocale = mowsContext?.currentLanguage?.code;
    const effectiveLocale = locale ?? contextLocale;
    const mergedStrings = useMemo(
        () => ({
            ...resolveOpeningHoursStrings(effectiveLocale),
            ...strings
        }),
        [effectiveLocale, strings]
    );
    const effectiveTone = toneClassName ?? DEFAULT_TONE_CLASS;
    const liveTick = useMinuteTicker(now === undefined && schedule === undefined);
    const referenceNow = useMemo(
        () => now ?? new Date(),
        // The minute ticker re-renders the component; we deliberately
        // depend on `liveTick` so a new `Date()` is produced each minute
        // when `now` isn't supplied externally.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [now, liveTick]
    );

    const parsed = useMemo(() => {
        if (schedule) return null;
        return parseOsmOpeningHours(rules ?? undefined);
    }, [schedule, rules]);

    const status: OpeningHoursStatus | null = useMemo(() => {
        if (schedule) return schedule.status;
        return buildOpeningHoursStatus(parsed, referenceNow, {
            locale: effectiveLocale,
            strings: mergedStrings
        });
    }, [schedule, parsed, referenceNow, effectiveLocale, mergedStrings]);

    const week: OpeningHoursWeek = useMemo(() => {
        if (schedule) return schedule.week;
        return buildOpeningHoursWeek(parsed, referenceNow, {
            locale: effectiveLocale,
            weekStart
        });
    }, [schedule, parsed, referenceNow, effectiveLocale, weekStart]);

    if (!status && week.length === 0) return null;

    const showStatus = variant !== `week` && status !== null;
    const showWeek = variant === `full` || variant === `week`;
    // Only the `full` variant has both halves to disclose — the others
    // already render exactly one half. Disabling `collapsible` (or
    // having no status / no week) keeps the inline layout for parity
    // with pre-collapsible callers and so tests can still inspect the
    // table without driving the disclosure.
    const useDisclosure =
        collapsible &&
        variant === `full` &&
        status !== null &&
        week.length > 0;

    if (useDisclosure) {
        return (
            <ExpandableSection
                className={className}
                style={style}
                testId={dataTestId}
                defaultOpen={defaultOpen}
                expandLabel={mergedStrings.scheduleLabel}
                collapseLabel={mergedStrings.scheduleLabel}
                triggerClassName={`px-3 py-2`}
                contentClassName={`px-3 py-2`}
                header={
                    <div data-variant={variant}>
                        <StatusLine
                            status={status}
                            toneClass={effectiveTone}
                            trailing={trailing}
                            showIcon={true}
                        />
                    </div>
                }
            >
                <WeekTable
                    week={week}
                    closedDayLabel={mergedStrings.closedDay}
                    scheduleLabel={mergedStrings.scheduleLabel}
                />
            </ExpandableSection>
        );
    }

    return (
        <div
            className={cn(`OpeningHours flex flex-col gap-2`, className)}
            style={style}
            data-testid={dataTestId}
            data-variant={variant}
        >
            {showStatus ? (
                <StatusLine
                    status={status}
                    toneClass={effectiveTone}
                    trailing={trailing}
                    showIcon={variant !== `inline`}
                />
            ) : null}
            {showWeek ? (
                <WeekTable
                    week={week}
                    closedDayLabel={mergedStrings.closedDay}
                    scheduleLabel={mergedStrings.scheduleLabel}
                />
            ) : null}
        </div>
    );
};

export default OpeningHours;
