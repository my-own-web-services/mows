export type DurationVariant = `long` | `medium` | `short`;

export type DurationUnit = `d` | `h` | `min` | `s`;

export interface DurationPart {
    readonly value: number;
    readonly unit: DurationUnit;
    /**
     * When `true`, the part represents *less than* `value` rather than
     * exactly `value` — used by `splitDuration` when the input is below
     * the requested `minUnit` precision so we render `<1 min` instead
     * of the misleading `0 min`.
     */
    readonly lessThan?: boolean;
}

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * 60;
const SECONDS_PER_DAY = SECONDS_PER_HOUR * 24;

const SECONDS_IN_UNIT: Record<DurationUnit, number> = {
    s: 1,
    min: SECONDS_PER_MINUTE,
    h: SECONDS_PER_HOUR,
    d: SECONDS_PER_DAY
};

export const DURATION_UNITS: ReadonlyArray<DurationUnit> = [`s`, `min`, `h`, `d`];

/**
 * Split a non-negative duration (in seconds) into at most two parts,
 * anchored to the largest non-zero unit. The next smaller unit is only
 * surfaced when it is non-zero, so an exact 1 h renders as `1 h` and
 * not `1 h 0 min`.
 *
 * `minUnit` is the coarsest precision the caller wants to see:
 *
 * - `"s"` (default) — full precision; sub-minute durations render as
 *   seconds.
 * - `"min"` — never show seconds; a 5 min 30 s duration floors to
 *   `5 min`.
 * - `"h"` — never show minutes or seconds; floors to whole hours.
 * - `"d"` — never show anything below days.
 *
 * When the input is *below* the requested precision (e.g. 30 s with
 * `minUnit="min"`, or `seconds === 0`) the result is a single part
 * with `lessThan: true` so the formatter renders `<1 min` / `<1 s`
 * instead of the misleading `0 min` / `0 s`.
 *
 * Negative inputs are treated as zero; fractional inputs are floored.
 */
export const splitDuration = (
    totalSeconds: number,
    minUnit: DurationUnit = `s`
): DurationPart[] => {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
    const unitSecs = SECONDS_IN_UNIT[minUnit];
    const floored = Math.floor(totalSeconds / unitSecs) * unitSecs;

    const days = Math.floor(floored / SECONDS_PER_DAY);
    const hours = Math.floor((floored % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
    const minutes = Math.floor((floored % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
    const seconds = floored % SECONDS_PER_MINUTE;

    if (days > 0) {
        const parts: DurationPart[] = [{ value: days, unit: `d` }];
        if (hours > 0) parts.push({ value: hours, unit: `h` });
        return parts;
    }
    if (hours > 0) {
        const parts: DurationPart[] = [{ value: hours, unit: `h` }];
        if (minutes > 0) parts.push({ value: minutes, unit: `min` });
        return parts;
    }
    if (minutes > 0) {
        const parts: DurationPart[] = [{ value: minutes, unit: `min` }];
        if (seconds > 0) parts.push({ value: seconds, unit: `s` });
        return parts;
    }
    if (seconds > 0) {
        return [{ value: seconds, unit: `s` }];
    }
    // Input is below `minUnit` precision (or exactly zero). Surface
    // that as `<1 [minUnit]` so we never display the literal
    // `0 [unit]` form — the caller's contract was "0 Sekunden darf
    // niemals dargestellt werden".
    return [{ value: 1, unit: minUnit, lessThan: true }];
};

const unitLabel = (unit: DurationUnit, variant: DurationVariant): string => {
    if (unit === `min`) return variant === `long` ? `min` : `m`;
    return unit;
};

/**
 * Format a list of duration parts using the verbosity rules of a
 * variant:
 *
 * - `long`   — full short labels with `min` spelled out: `1 h 10 min`.
 * - `medium` — single-letter labels (`min` → `m`): `1 h 10 m`.
 * - `short`  — drop the trailing unit label entirely: `1 h 10`.
 *
 * The leading parts keep their label across all variants — only the
 * final part's label collapses. Parts flagged `lessThan` always render
 * as `<value unit` (the unit is preserved even in the `short` variant
 * because `<1` on its own would be too cryptic).
 */
export const formatDurationParts = (
    parts: ReadonlyArray<DurationPart>,
    variant: DurationVariant
): string => {
    if (parts.length === 0) return ``;
    return parts
        .map((part, index) => {
            const isLast = index === parts.length - 1;
            const label = unitLabel(part.unit, variant);
            if (part.lessThan) {
                return `<${part.value} ${label}`;
            }
            if (variant === `short` && isLast) {
                return String(part.value);
            }
            return `${part.value} ${label}`;
        })
        .join(` `);
};

export const formatDuration = (
    totalSeconds: number,
    variant: DurationVariant,
    minUnit: DurationUnit = `s`
): string => {
    return formatDurationParts(splitDuration(totalSeconds, minUnit), variant);
};

export const DURATION_VARIANTS: ReadonlyArray<DurationVariant> = [`long`, `medium`, `short`];
