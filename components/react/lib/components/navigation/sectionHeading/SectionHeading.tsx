import * as React from "react";
import { cn } from "@/lib/utils";
import { scrollToSection } from "../pageIndex/PageIndex";

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface SectionHeadingProps {
    /** DOM id for the heading. Becomes the URL hash on click. */
    readonly id: string;
    /** Heading level — renders as `h1`–`h6`. Defaults to `h2`. */
    readonly level?: HeadingLevel;
    /** Heading content. */
    readonly children: React.ReactNode;
    /**
     * Pixels of headroom to leave above the heading when scrolling to it,
     * matching the offset used by `<PageIndex>` (default 80).
     */
    readonly scrollOffset?: number;
    readonly className?: string;
    /** Extra class names applied to the inner anchor. */
    readonly linkClassName?: string;
}

/**
 * A heading whose text is itself a permalink. Hovering underlines the
 * heading; clicking it pushes `#id` onto the URL so the section is
 * shareable, and smoothly scrolls the heading into view via
 * `scrollToSection` (which respects inner scroll containers like a
 * Radix `ScrollArea`).
 *
 * Visual styling for the heading text is the consumer's responsibility —
 * pass `text-xl font-semibold ...` etc. via `className`. The component
 * only adds the hover-underline affordance and a `scroll-mt-20` so the
 * heading isn't hidden behind a sticky header on initial hash navigation.
 */
export const SectionHeading = ({
    id,
    level = 2,
    children,
    scrollOffset = 80,
    className,
    linkClassName
}: SectionHeadingProps) => {
    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        // Native anchor scrolling doesn't account for inner scroll
        // containers, so do it ourselves and keep history clean by only
        // pushing when the hash actually changes.
        e.preventDefault();
        scrollToSection(id, scrollOffset);
        if (window.location.hash !== `#${id}`) {
            window.history.pushState(null, ``, `#${id}`);
        }
    };

    return React.createElement(
        `h${level}`,
        { id, className: cn(`scroll-mt-20`, className) },
        // Wrapper exists only to scope the hover-affordance — the "#" marker
        // fades in when the user is anywhere inside the heading row, but
        // only the actual title text is the clickable link target. Clicking
        // padding, the gap, or the "#" itself does nothing.
        <span className={`group inline-flex items-baseline gap-2`}>
            <a
                href={`#${id}`}
                onClick={handleClick}
                className={cn(
                    `cursor-pointer no-underline hover:underline focus-visible:underline focus-visible:outline-none`,
                    linkClassName
                )}
            >
                {children}
            </a>
            <span
                aria-hidden
                className={`inline-block text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100`}
            >
                #
            </span>
        </span>
    );
};

export default SectionHeading;
