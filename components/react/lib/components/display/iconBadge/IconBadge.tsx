import { cn } from "@/lib/utils";
import { type CSSProperties, type ReactNode } from "react";

export type IconBadgePosition =
    | `top-left`
    | `top`
    | `top-right`
    | `right`
    | `bottom-right`
    | `bottom`
    | `bottom-left`
    | `left`;

export interface IconBadgeProps {
    /** Primary icon. Pre-sized by the caller (e.g. `<File size={48} />`). */
    readonly icon: ReactNode;
    /** Sub-icon shown at the configured anchor. Pre-sized by the caller. */
    readonly badge: ReactNode;
    /**
     * Overall outer size in pixels. The component lays out as a
     * `size × size` inline-flex box; the primary icon centres inside,
     * the badge anchors to the configured position. Defaults to `32`.
     */
    readonly size?: number;
    /**
     * Diameter of the circular cutout, as a fraction of `size`.
     * Defaults to `0.5`. The visible "hole" is a true CSS-mask
     * subtraction so the parent surface's pixels show through — drop
     * the component on any background and the cutout stays genuinely
     * transparent.
     */
    readonly badgeFraction?: number;
    /**
     * Which side of the primary icon the badge anchors to: the four
     * corners or the four edge midpoints. Defaults to `bottom-right`.
     */
    readonly badgePosition?: IconBadgePosition;
    /**
     * Extra cut radius beyond the badge wrapper, in pixels. `0` lines
     * the cutout edge up exactly with the badge box; `2`–`4` opens
     * a clearly visible margin between the badge sub-icon and the
     * primary icon's strokes. Defaults to `2`.
     */
    readonly badgeGap?: number;
    /**
     * Classes applied to the visible badge container. The container
     * has no border or fill by default — the visible "circle" is the
     * masked hole. Pass `bg-emerald-500` (and a contrasting sub-icon
     * colour) for a filled status indicator.
     */
    readonly badgeClassName?: string;
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface PositionSpec {
    readonly anchor: (halfBadge: number) => CSSProperties;
    readonly maskCenterX: (halfBadge: number) => string;
    readonly maskCenterY: (halfBadge: number) => string;
}

const POSITIONS: Record<IconBadgePosition, PositionSpec> = {
    "top-left": {
        anchor: () => ({ left: 0, top: 0 }),
        maskCenterX: (h) => `${h}px`,
        maskCenterY: (h) => `${h}px`
    },
    top: {
        anchor: (h) => ({ left: `calc(50% - ${h}px)`, top: 0 }),
        maskCenterX: () => `50%`,
        maskCenterY: (h) => `${h}px`
    },
    "top-right": {
        anchor: () => ({ right: 0, top: 0 }),
        maskCenterX: (h) => `calc(100% - ${h}px)`,
        maskCenterY: (h) => `${h}px`
    },
    right: {
        anchor: (h) => ({ right: 0, top: `calc(50% - ${h}px)` }),
        maskCenterX: (h) => `calc(100% - ${h}px)`,
        maskCenterY: () => `50%`
    },
    "bottom-right": {
        anchor: () => ({ right: 0, bottom: 0 }),
        maskCenterX: (h) => `calc(100% - ${h}px)`,
        maskCenterY: (h) => `calc(100% - ${h}px)`
    },
    bottom: {
        anchor: (h) => ({ left: `calc(50% - ${h}px)`, bottom: 0 }),
        maskCenterX: () => `50%`,
        maskCenterY: (h) => `calc(100% - ${h}px)`
    },
    "bottom-left": {
        anchor: () => ({ left: 0, bottom: 0 }),
        maskCenterX: (h) => `${h}px`,
        maskCenterY: (h) => `calc(100% - ${h}px)`
    },
    left: {
        anchor: (h) => ({ left: 0, top: `calc(50% - ${h}px)` }),
        maskCenterX: (h) => `${h}px`,
        maskCenterY: () => `50%`
    }
};

/**
 * Icon with a sub-icon overlay at one of eight anchor positions —
 * the four corners or the four edge midpoints.
 *
 * The cutout is a circular `mask-image` radial gradient applied to
 * the primary icon, so the carved area is **genuinely transparent**:
 * drop the component on a card, a gradient, a checkerboard or a
 * photo and the underlying pixels show through verbatim. No
 * parent-matching fill colour, no blend-mode trickery.
 *
 * The visible badge container has no border or fill by default;
 * pass `badgeClassName` for a filled status indicator.
 */
export const IconBadge = ({
    icon,
    badge,
    size = 32,
    badgeFraction = 0.5,
    badgePosition = `bottom-right`,
    badgeGap = 2,
    badgeClassName,
    className,
    style
}: IconBadgeProps) => {
    const badgeSize = Math.round(size * badgeFraction);
    const halfBadge = badgeSize / 2;
    // The mask cuts a circle of `halfBadge + badgeGap` around the
    // badge centre. The 99% → 100% step keeps the edge crisp.
    const cutRadius = halfBadge + badgeGap;
    const spec = POSITIONS[badgePosition];
    const cx = spec.maskCenterX(halfBadge);
    const cy = spec.maskCenterY(halfBadge);
    const maskImage = `radial-gradient(circle ${cutRadius}px at ${cx} ${cy}, transparent 99%, black 100%)`;
    const maskStyle: CSSProperties = {
        WebkitMaskImage: maskImage,
        maskImage
    };

    return (
        <span
            className={cn(
                `IconBadge relative inline-flex shrink-0 items-center justify-center`,
                className
            )}
            style={{ width: size, height: size, ...style }}
            data-position={badgePosition}
        >
            <span
                className={`flex h-full w-full items-center justify-center`}
                style={maskStyle}
                data-testid={`icon-badge-icon`}
            >
                {icon}
            </span>
            <span
                className={cn(
                    `absolute flex items-center justify-center rounded-full`,
                    badgeClassName
                )}
                style={{
                    width: badgeSize,
                    height: badgeSize,
                    ...spec.anchor(halfBadge)
                }}
                data-testid={`icon-badge-badge`}
            >
                {badge}
            </span>
        </span>
    );
};

export default IconBadge;
