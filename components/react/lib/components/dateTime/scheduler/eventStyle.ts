/** Theme-aware event colouring. An event's `color` is any CSS colour; we
 *  mix it with the surface tokens via `color-mix` so the same value reads
 *  correctly in light and dark without hardcoding neutral palettes. */

/** The saturated accent (border / dot / left bar). Defaults to the primary. */
export const eventAccent = (color?: string): string => color ?? `var(--primary)`;

/** A soft fill that sits on a `--card` surface (chips, month bands). */
export const eventTint = (color?: string): string =>
    `color-mix(in oklab, ${eventAccent(color)} 20%, var(--card))`;

/** A slightly stronger fill for the larger time-grid blocks. */
export const eventTintStrong = (color?: string): string =>
    `color-mix(in oklab, ${eventAccent(color)} 30%, var(--card))`;
