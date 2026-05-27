import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
    DEFAULT_LYRICS_STRINGS,
    findActiveLineIndex,
    findActiveWordIndex,
    parseLrc,
    type LyricsStrings,
    type LyricsVariant,
    type ParsedLyrics
} from "./types";

export interface LyricsProps {
    /** Either a raw LRC-formatted string or a pre-parsed `ParsedLyrics`
     * value. Pre-parse when the same lyrics render in many places — it
     * avoids re-running the parser on every render. */
    readonly source: string | ParsedLyrics;
    /** Current playback time in seconds. Drive this from your audio
     * element's `timeupdate` handler, an external scrubber, or any other
     * clock. */
    readonly currentTime: number;
    /** `scrolling` is the default; the active line is kept in view and
     * inactive lines fade away from it. `compact` skips auto-scroll and
     * keeps every line at full opacity — useful when the surrounding
     * surface is already constrained. */
    readonly variant?: LyricsVariant;
    /** When set, lines become click targets that call back with the
     * line's start time in seconds. Most consumers wire this to their
     * audio element's `currentTime`. */
    readonly onSeek?: (seconds: number) => void;
    /** Override the auto-scroll behaviour of the `scrolling` variant.
     * Defaults to `true`. */
    readonly autoScroll?: boolean;
    /** Override individual translated strings. */
    readonly strings?: Partial<LyricsStrings>;
    /** Rendered above the lines when the metadata or this prop is set.
     * Provide your own node to keep the header consistent across the
     * surrounding shell. */
    readonly header?: ReactNode;
    /** Replace the fallback shown when the source contains no usable
     * lines. */
    readonly emptyState?: ReactNode;
    readonly className?: string;
    readonly style?: CSSProperties;
    /** `aria-label` for the outer region. Falls back to the
     * translated `title`. */
    readonly ariaLabel?: string;
}

const isParsed = (input: string | ParsedLyrics): input is ParsedLyrics => {
    return typeof input !== `string` && `lines` in input;
};

export const Lyrics = ({
    source,
    currentTime,
    variant = `scrolling`,
    onSeek,
    autoScroll = true,
    strings,
    header,
    emptyState,
    className,
    style,
    ariaLabel
}: LyricsProps) => {
    const t = { ...DEFAULT_LYRICS_STRINGS, ...strings };

    const parsed = useMemo<ParsedLyrics>(() => {
        return isParsed(source) ? source : parseLrc(source);
    }, [source]);

    const { lines, metadata } = parsed;
    const activeIndex = findActiveLineIndex(lines, currentTime);
    const isInteractive = typeof onSeek === `function`;

    const containerRef = useRef<HTMLDivElement>(null);
    const lineRefs = useRef<Array<HTMLLIElement | null>>([]);

    // Keep the active line centred when the variant supports auto-scroll.
    // We scope the scroll to the local container by computing offsets
    // ourselves rather than calling `scrollIntoView`, which would scroll
    // the page when the lyrics live inside a larger layout.
    useEffect(() => {
        if (variant !== `scrolling` || !autoScroll) return;
        if (activeIndex < 0) return;
        const container = containerRef.current;
        const el = lineRefs.current[activeIndex];
        if (!container || !el) return;

        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const offsetTop = elRect.top - containerRect.top + container.scrollTop;
        const target = offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
        container.scrollTo({ top: Math.max(0, target), behavior: `smooth` });
    }, [activeIndex, variant, autoScroll]);

    if (lines.length === 0) {
        return (
            <div
                role={`region`}
                aria-label={ariaLabel ?? t.title}
                data-testid={`lyrics`}
                data-variant={variant}
                data-state={`empty`}
                style={style}
                className={cn(
                    `Lyrics flex h-full w-full flex-col items-center justify-center rounded-md border border-dashed bg-card p-6 text-sm text-muted-foreground`,
                    className
                )}
            >
                {emptyState ?? <p>{t.empty}</p>}
            </div>
        );
    }

    const hasAnyTimings = lines.some((line) => Number.isFinite(line.time) && line.time > 0);
    const noTimingsNote = !hasAnyTimings && lines.length > 1 ? t.noTimings : null;

    const isScrolling = variant === `scrolling`;

    const resolvedHeader = header ?? (metadata.title || metadata.artist ? (
        <header className={`mb-3 shrink-0`}>
            {metadata.title ? (
                <h3 className={`truncate text-base font-semibold tracking-tight`}>
                    {metadata.title}
                </h3>
            ) : null}
            {metadata.artist ? (
                <p className={`truncate text-sm text-muted-foreground`}>
                    {metadata.artist}
                </p>
            ) : null}
        </header>
    ) : null);

    return (
        <div
            role={`region`}
            aria-label={ariaLabel ?? metadata.title ?? t.title}
            data-testid={`lyrics`}
            data-variant={variant}
            style={style}
            className={cn(
                `Lyrics flex w-full flex-col rounded-md border bg-card p-4 text-card-foreground shadow-sm`,
                isScrolling && `max-h-[480px]`,
                className
            )}
        >
            {resolvedHeader}
            {noTimingsNote ? (
                <p className={`mb-2 shrink-0 text-xs text-muted-foreground`}>{noTimingsNote}</p>
            ) : null}
            <div
                ref={containerRef}
                className={cn(
                    `min-h-0 flex-1`,
                    isScrolling && `overflow-y-auto scroll-smooth`
                )}
                data-testid={`lyrics-scroll`}
            >
                <ol
                    className={cn(
                        `flex list-none flex-col gap-1 text-center`,
                        isScrolling && `py-[40%]`
                    )}
                >
                    {lines.map((line, index) => {
                        const isActive = index === activeIndex;
                        const isPast = index < activeIndex;
                        const activeWord = isActive
                            ? findActiveWordIndex(line, currentTime)
                            : -1;

                        const content =
                            line.words && line.words.length > 0 ? (
                                <span className={`inline-flex flex-wrap justify-center gap-x-1.5`}>
                                    {line.words.map((word, wIndex) => {
                                        const wordIsActive = isActive && wIndex === activeWord;
                                        const wordIsPast = isActive && wIndex < activeWord;
                                        return (
                                            <span
                                                key={`${word.time}-${wIndex}`}
                                                data-testid={`lyrics-word`}
                                                data-active={wordIsActive ? `true` : undefined}
                                                className={cn(
                                                    `transition-colors duration-150`,
                                                    wordIsActive && `font-semibold text-primary`,
                                                    wordIsPast && `text-foreground`,
                                                    !wordIsActive && !wordIsPast && `text-muted-foreground`
                                                )}
                                            >
                                                {word.text}
                                            </span>
                                        );
                                    })}
                                </span>
                            ) : (
                                line.text || ` `
                            );

                        const lineClasses = cn(
                            `rounded-sm px-2 py-1 transition-all duration-200`,
                            isActive
                                ? `text-base font-semibold text-foreground sm:text-lg`
                                : `text-sm`,
                            !isActive && isScrolling && (isPast ? `opacity-40` : `opacity-60`),
                            !isActive && !isScrolling && `text-muted-foreground`,
                            isInteractive && hasAnyTimings && `cursor-pointer hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none`
                        );

                        const setRef = (el: HTMLLIElement | null): void => {
                            lineRefs.current[index] = el;
                        };

                        return (
                            <li
                                key={`${line.time}-${index}`}
                                ref={setRef}
                                data-testid={`lyrics-line`}
                                data-active={isActive ? `true` : undefined}
                                data-line-index={index}
                                aria-current={isActive ? `true` : undefined}
                                className={lineClasses}
                                {...(isInteractive && hasAnyTimings
                                    ? {
                                          role: `button`,
                                          tabIndex: 0,
                                          "aria-label": `${t.seekToLine} — ${line.text}`,
                                          onClick: () => onSeek?.(line.time),
                                          onKeyDown: (e) => {
                                              if (e.key === `Enter` || e.key === ` `) {
                                                  e.preventDefault();
                                                  onSeek?.(line.time);
                                              }
                                          }
                                      }
                                    : {})}
                            >
                                {content}
                            </li>
                        );
                    })}
                </ol>
            </div>
        </div>
    );
};

export default Lyrics;
