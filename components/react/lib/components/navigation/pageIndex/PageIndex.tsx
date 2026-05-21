import * as React from "react";
import { cn } from "@/lib/utils";
import { MowsContext } from "@/lib/mowsContext/MowsContext";

export interface PageIndexItem {
    readonly id: string;
    readonly label: React.ReactNode;
    /**
     * Nested entries. Rendered as an indented sub-list under this item.
     * The scrollspy treats nested ids exactly like top-level ones; nesting
     * is presentation-only.
     */
    readonly children?: ReadonlyArray<PageIndexItem>;
}

const flattenIds = (items: ReadonlyArray<PageIndexItem>): string[] => {
    const out: string[] = [];
    for (const item of items) {
        out.push(item.id);
        if (item.children) out.push(...flattenIds(item.children));
    }
    return out;
};

export interface PageIndexProps {
    readonly items: ReadonlyArray<PageIndexItem>;
    readonly className?: string;
    /**
     * Pixels of vertical headroom to leave above the active section. The
     * section whose top edge sits closest to (but not past) this offset is
     * marked active. Defaults to 80 — leaves room for a sticky app header.
     */
    readonly scrollOffset?: number;
    /**
     * Accessible label for the `<nav>`. Defaults to the translated value
     * from `MowsContext.t.pageIndex.ariaLabel`.
     */
    readonly ariaLabel?: string;
    /**
     * Heading shown above the list. Defaults to the translated value from
     * `MowsContext.t.pageIndex.heading`. Pass `null` to hide it entirely.
     */
    readonly heading?: React.ReactNode;
}

/**
 * Walks up from `el` looking for the nearest scrollable ancestor. This is
 * what we need to scroll — using `window.scrollTo` is wrong whenever the
 * page is laid out with a scrollable inner container (sidebars, app
 * shells, Radix `ScrollArea`, etc.); the window itself never moves.
 *
 * "Scrollable" = either has `overflow-y: auto|scroll` *and* has overflow,
 * or carries the `data-radix-scroll-area-viewport` attribute (Radix
 * ScrollArea hides the native overflow style behind its own scrollbar
 * impl, so we anchor on the attribute as a fallback). Returns `window`
 * when no inner container is found.
 */
const getScrollContainer = (el: Element): Element | Window => {
    let node: HTMLElement | null = el.parentElement;
    while (node && node !== document.body && node !== document.documentElement) {
        const style = window.getComputedStyle(node);
        const overflowY = style.overflowY;
        const isRadixViewport = node.hasAttribute(`data-radix-scroll-area-viewport`);
        const looksScrollable =
            overflowY === `auto` || overflowY === `scroll` || isRadixViewport;
        if (looksScrollable && node.scrollHeight > node.clientHeight) {
            return node;
        }
        node = node.parentElement;
    }
    return window;
};

const scrollContainerFor = (ids: ReadonlyArray<string>): Element | Window | null => {
    for (const id of ids) {
        const el = document.getElementById(id);
        if (el) return getScrollContainer(el);
    }
    return null;
};

/** Fail-safe ceiling for how long a click-lock can hold (ms). */
const CLICK_LOCK_TIMEOUT_MS = 1500;

interface ClickLock {
    readonly id: string;
    readonly until: number;
}

/**
 * Tracks which section is currently in view by reading the bounding rect
 * of every observed `id` on scroll.
 *
 * Coordinates are measured **relative to the scroll container's top edge**,
 * not the viewport. That's the only thing that matches what
 * `scrollToSection` actually scrolls to: when the container sits below the
 * viewport top (sidebars, app shells, Radix `ScrollArea`), the landed
 * section's viewport `top` is `containerTop + offset`, not `offset` — so
 * a viewport-relative threshold would never pick it.
 *
 * Returns `[active, lockTo]`. `lockTo(id)` is meant to be called on a
 * link-click: it sets the highlight immediately and tells the scrollspy
 * to ignore intermediate updates until either its own computation lands
 * on the locked id (= we've reached the target) or
 * {@link CLICK_LOCK_TIMEOUT_MS} elapses (fail-safe). Without the lock the
 * smooth-scroll animation's intermediate scroll events would keep flipping
 * the highlight to whatever section happens to be at the threshold mid-
 * animation, and a small rounding error at the final position could leave
 * the highlight on the previous section even after landing.
 */
const useActiveSection = (
    ids: ReadonlyArray<string>,
    offset: number
): [string | null, (id: string) => void] => {
    const [active, setActive] = React.useState<string | null>(ids[0] ?? null);
    const lockRef = React.useRef<ClickLock | null>(null);
    const idsKey = ids.join(`|`);

    React.useEffect(() => {
        if (ids.length === 0) return;

        const container = scrollContainerFor(ids) ?? window;

        const updateActive = () => {
            const containerTop =
                container === window
                    ? 0
                    : (container as HTMLElement).getBoundingClientRect().top;

            let best: { id: string; top: number } | null = null;
            for (const id of ids) {
                const el = document.getElementById(id);
                if (!el) continue;
                const top = el.getBoundingClientRect().top - containerTop;
                if (top - offset <= 0 && (!best || top > best.top)) {
                    best = { id, top };
                }
            }
            const next = best?.id ?? ids[0] ?? null;

            const lock = lockRef.current;
            if (lock) {
                if (next === lock.id || Date.now() > lock.until) {
                    // landed on the locked target (or timed out) — release.
                    lockRef.current = null;
                    setActive(next);
                }
                // mid-animation: keep the locked id, drop this update.
                return;
            }
            setActive(next);
        };
        updateActive();

        container.addEventListener(`scroll`, updateActive, { passive: true });
        window.addEventListener(`resize`, updateActive);
        return () => {
            container.removeEventListener(`scroll`, updateActive);
            window.removeEventListener(`resize`, updateActive);
        };
        // ids is captured via the join key — see comment above.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idsKey, offset]);

    const lockTo = React.useCallback((id: string) => {
        lockRef.current = { id, until: Date.now() + CLICK_LOCK_TIMEOUT_MS };
        setActive(id);
    }, []);

    return [active, lockTo];
};

/**
 * Scrolls the element with the given id into view in whichever container
 * actually owns its scroll (window or the nearest scrollable ancestor).
 * Returns `false` if the id doesn't resolve.
 *
 * @param behavior `"smooth"` (default) for animated scroll, `"auto"` for
 *        an instant jump. Use `"auto"` on initial page load so the
 *        deep-linked section lands instantly without the URL-hash visibly
 *        animating in.
 */
export const scrollToSection = (
    id: string,
    offset = 80,
    behavior: ScrollBehavior = `smooth`
): boolean => {
    const el = document.getElementById(id);
    if (!el) return false;
    const container = getScrollContainer(el);
    if (container === window) {
        const top = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior });
    } else {
        const c = container as HTMLElement;
        const elTop = el.getBoundingClientRect().top;
        const cTop = c.getBoundingClientRect().top;
        const top = elTop - cTop + c.scrollTop - offset;
        c.scrollTo({ top, behavior });
    }
    return true;
};

/**
 * "On this page" page index. Each item links to an element with a
 * matching `id`. Clicking smoothly scrolls to the section and replaces
 * the URL hash; the entry whose section is currently in view is visually
 * marked active.
 *
 * IDs are passed in; the consumer is responsible for rendering the
 * matching elements (e.g. `<Card id="example-horizontal">`).
 */
export const PageIndex = ({
    items,
    className,
    scrollOffset = 80,
    ariaLabel,
    heading
}: PageIndexProps) => {
    const ctx = React.useContext(MowsContext);
    const t = ctx?.t.pageIndex;
    const resolvedAriaLabel = ariaLabel ?? t?.ariaLabel ?? `On this page`;
    const resolvedHeading = heading === undefined ? (t?.heading ?? `On this page`) : heading;

    const ids = React.useMemo(() => flattenIds(items), [items]);
    const [active, lockTo] = useActiveSection(ids, scrollOffset);

    // On mount: if the URL already names a section, jump to it instantly.
    // The browser doesn't natively scroll to anchors whose elements mount
    // after page load (React render is async), so we do it ourselves. We
    // use behavior:"auto" — a deep-linked load should land at the target
    // immediately; only user clicks should animate.
    React.useEffect(() => {
        const hash = window.location.hash.replace(/^#/, ``);
        if (!hash) return;
        if (!ids.includes(hash)) return;
        const handle = window.requestAnimationFrame(() => {
            scrollToSection(hash, scrollOffset, `auto`);
        });
        return () => window.cancelAnimationFrame(handle);
        // Run once on mount only. ids is captured via closure.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
        e.preventDefault();
        const ok = scrollToSection(id, scrollOffset);
        if (ok) {
            // Highlight immediately and hold it for the duration of the
            // smooth scroll — see comment on useActiveSection.
            lockTo(id);
            // replaceState (not pushState) so back-button steps out of the
            // whole page rather than rewinding TOC clicks one by one.
            window.history.replaceState(null, ``, `#${id}`);
        }
    };

    const renderItems = (entries: ReadonlyArray<PageIndexItem>, depth: number) => (
        <ul
            className={cn(
                `flex flex-col gap-1`,
                depth === 0 && `border-l border-border`
            )}
        >
            {entries.map((item) => {
                const isActive = item.id === active;
                return (
                    <li key={item.id}>
                        <a
                            href={`#${item.id}`}
                            onClick={(e) => handleClick(e, item.id)}
                            aria-current={isActive ? `location` : undefined}
                            style={{
                                // Each level indents by 12px so nesting is visually
                                // obvious without crowding the link text.
                                paddingLeft: `${12 + depth * 12}px`
                            }}
                            className={cn(
                                `block -ml-px border-l-2 py-1 pr-3 transition-colors`,
                                isActive
                                    ? `border-primary text-foreground`
                                    : `border-transparent text-muted-foreground hover:border-border hover:text-foreground`
                            )}
                        >
                            {item.label}
                        </a>
                        {item.children && item.children.length > 0 &&
                            renderItems(item.children, depth + 1)}
                    </li>
                );
            })}
        </ul>
    );

    if (items.length === 0) return null;

    return (
        <nav aria-label={resolvedAriaLabel} className={cn(`text-sm`, className)}>
            {resolvedHeading !== null && (
                <p className={`mb-2 font-medium text-foreground`}>{resolvedHeading}</p>
            )}
            {renderItems(items, 0)}
        </nav>
    );
};

export default PageIndex;
