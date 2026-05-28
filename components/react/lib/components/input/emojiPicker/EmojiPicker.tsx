import { Search, X } from "lucide-react";
import {
    forwardRef,
    useCallback,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type KeyboardEvent
} from "react";
import { cn } from "@/lib/utils";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "../../ui/dropdown-menu";
import {
    applySkinTone,
    emojisInCategory,
    EMOJI_CATEGORIES,
    EMOJI_DATA,
    searchEmojis,
    SKIN_TONE_MODIFIERS,
    type EmojiCategoryId,
    type EmojiEntry,
    type SkinToneIndex
} from "./emojiData";
import {
    DEFAULT_EMOJI_PICKER_STRINGS,
    type EmojiPickerProps,
    type EmojiPickerStrings
} from "./types";

const DEFAULT_HEIGHT = 360;
const DEFAULT_COLUMNS = 9;
const DEFAULT_MAX_RECENT = 24;
const DEFAULT_STORAGE_PREFIX = `mows-emoji-picker`;

export interface EmojiPickerHandle {
    readonly focusSearch: () => void;
    readonly clearSearch: () => void;
}

const mergeStrings = (
    partial: Partial<EmojiPickerStrings> | undefined
): EmojiPickerStrings => {
    if (!partial) return DEFAULT_EMOJI_PICKER_STRINGS;
    return {
        ...DEFAULT_EMOJI_PICKER_STRINGS,
        ...partial,
        categoryNames: {
            ...DEFAULT_EMOJI_PICKER_STRINGS.categoryNames,
            ...(partial.categoryNames ?? {})
        }
    };
};

const readJson = <T,>(key: string, fallback: T): T => {
    if (typeof window === `undefined`) return fallback;
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return parsed as T;
    } catch {
        // Corrupted or unavailable storage — treat as empty rather than
        // tearing down the whole picker.
        return fallback;
    }
};

const writeJson = (key: string, value: unknown): void => {
    if (typeof window === `undefined`) return;
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Quota exhaustion or private-mode lockout — silently ignore.
    }
};

const SKIN_TONE_SWATCHES: ReadonlyArray<{ tone: SkinToneIndex; emoji: string }> = [
    { tone: 0, emoji: `✋` },
    { tone: 1, emoji: `✋🏻` },
    { tone: 2, emoji: `✋🏼` },
    { tone: 3, emoji: `✋🏽` },
    { tone: 4, emoji: `✋🏾` },
    { tone: 5, emoji: `✋🏿` }
];

const EmojiPicker = forwardRef<EmojiPickerHandle, EmojiPickerProps>((props, ref) => {
    const {
        onSelect,
        onClose,
        hideRecent,
        hideSearch,
        hideSkinTone,
        skinTone: controlledSkinTone,
        onSkinToneChange,
        columns = DEFAULT_COLUMNS,
        maxRecent = DEFAULT_MAX_RECENT,
        storagePrefix = DEFAULT_STORAGE_PREFIX,
        strings: stringsProp,
        className,
        style,
        height = DEFAULT_HEIGHT
    } = props;

    const strings = useMemo(() => mergeStrings(stringsProp), [stringsProp]);

    const recentKey = storagePrefix ? `${storagePrefix}-recent` : null;
    const skinKey = storagePrefix ? `${storagePrefix}-skin` : null;

    const [recents, setRecents] = useState<ReadonlyArray<string>>(() =>
        recentKey ? readJson<ReadonlyArray<string>>(recentKey, []) : []
    );
    const [internalSkinTone, setInternalSkinTone] = useState<SkinToneIndex>(() => {
        if (controlledSkinTone !== undefined) return controlledSkinTone;
        if (!skinKey) return 0;
        const raw = readJson<number>(skinKey, 0);
        if (raw >= 0 && raw <= 5) return raw as SkinToneIndex;
        return 0;
    });
    const skinTone = controlledSkinTone ?? internalSkinTone;

    const setSkinTone = useCallback(
        (next: SkinToneIndex) => {
            if (controlledSkinTone === undefined) setInternalSkinTone(next);
            onSkinToneChange?.(next);
            if (skinKey) writeJson(skinKey, next);
        },
        [controlledSkinTone, onSkinToneChange, skinKey]
    );

    const [query, setQuery] = useState(``);
    const [activeCategory, setActiveCategory] = useState<EmojiCategoryId>(`smileys`);
    const searchRef = useRef<HTMLInputElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);

    useImperativeHandle(
        ref,
        () => ({
            focusSearch: () => searchRef.current?.focus(),
            clearSearch: () => setQuery(``)
        }),
        []
    );

    // Lookup table: char -> entry so we can resolve "recent" strings back
    // to their skin-tone-capable metadata when re-rendering the recents
    // row at a different tone setting.
    const entriesByChar = useMemo(() => {
        const map = new Map<string, EmojiEntry>();
        for (const e of EMOJI_DATA) map.set(e.char, e);
        return map;
    }, []);

    const searchResults = useMemo(() => searchEmojis(query), [query]);

    const handleSelect = useCallback(
        (entry: EmojiEntry) => {
            const final = entry.hasSkinTone ? applySkinTone(entry.char, skinTone) : entry.char;
            onSelect(final, entry);
            if (!recentKey) return;
            // Most-recently-used: dedupe by base char, push to front,
            // truncate. Skin-tone variants share a row so the recents
            // strip doesn't get cluttered with the same hand at different
            // tones.
            setRecents((prev) => {
                const filtered = prev.filter((c) => c !== entry.char);
                const next = [entry.char, ...filtered].slice(0, maxRecent);
                writeJson(recentKey, next);
                return next;
            });
        },
        [maxRecent, onSelect, recentKey, skinTone]
    );

    const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === `Escape`) {
            e.preventDefault();
            if (query.length > 0) {
                setQuery(``);
                return;
            }
            onClose?.();
            return;
        }
        if (e.key === `Enter`) {
            const first = searchResults[0];
            if (first) {
                e.preventDefault();
                handleSelect(first);
            }
        }
    };

    const renderEmojiButton = (entry: EmojiEntry, key: string) => {
        const display = entry.hasSkinTone ? applySkinTone(entry.char, skinTone) : entry.char;
        return (
            <button
                key={key}
                type={`button`}
                data-testid={`emoji-cell`}
                data-emoji={entry.char}
                data-category={entry.category}
                title={entry.name}
                aria-label={entry.name}
                // mousedown.preventDefault keeps focus from moving to the
                // cell button on click — which prevented the surrounding
                // doc-page / chat-surface ScrollArea from scrolling the
                // newly-focused button into view. The onClick handler
                // still fires because the click event isn't suppressed.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(entry)}
                className={cn(
                    `hover:bg-accent flex aspect-square items-center justify-center rounded-md text-xl leading-none focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring`
                )}
            >
                {display}
            </button>
        );
    };

    const showRecents = !hideRecent && query.length === 0 && recents.length > 0;
    const showSearchResults = query.length > 0;

    const gridStyle = useMemo(
        () => ({ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }),
        [columns]
    );

    // Scroll the picker's own container — never `Element.scrollIntoView`,
    // which walks up scrollable ancestors and ends up scrolling whatever
    // page hosts the picker (e.g. a doc page or chat surface). We compute
    // the target offset against the container's bounding rect and call
    // `container.scrollTo` directly so the surrounding page stays put.
    const scrollCategoryIntoView = useCallback((id: EmojiCategoryId) => {
        const container = scrollRef.current;
        if (!container) return;
        const node = container.querySelector<HTMLElement>(
            `[data-category-section="${id}"]`
        );
        if (!node) return;
        const containerTop = container.getBoundingClientRect().top;
        const nodeTop = node.getBoundingClientRect().top;
        const target = container.scrollTop + (nodeTop - containerTop);
        container.scrollTo({ top: target, behavior: `smooth` });
    }, []);

    // Update the active tab as the user scrolls so the highlighted
    // category always matches what's actually visible. We look for the
    // section header that's just below the scroll container's top edge.
    // Crucially: scrolling NEVER re-triggers a scroll — the tab indicator
    // is read-only here. Only an explicit category-tab click runs
    // scrollCategoryIntoView; otherwise the user-scroll → setActive →
    // scroll-into-view → user-scroll loop would fight every gesture.
    const handleScroll = useCallback(() => {
        if (showSearchResults) return;
        const container = scrollRef.current;
        if (!container) return;
        const headers = container.querySelectorAll<HTMLElement>(`[data-category-section]`);
        const top = container.getBoundingClientRect().top;
        let current: EmojiCategoryId | null = null;
        for (const node of Array.from(headers)) {
            const rect = node.getBoundingClientRect();
            if (rect.top - top <= 8) {
                current = node.dataset.categorySection as EmojiCategoryId;
            } else {
                break;
            }
        }
        if (current && current !== activeCategory) {
            setActiveCategory(current);
        }
    }, [activeCategory, showSearchResults]);

    return (
        <div
            data-testid={`emoji-picker`}
            className={cn(
                `EmojiPicker bg-card text-card-foreground flex w-full max-w-[320px] flex-col overflow-hidden rounded-md border shadow-sm`,
                className
            )}
            style={{ height: `${height}px`, ...style }}
        >
            {!hideSearch && (
                <div className={`relative border-b p-2`}>
                    <Search
                        aria-hidden
                        className={`text-muted-foreground pointer-events-none absolute top-1/2 left-4 h-3.5 w-3.5 -translate-y-1/2`}
                    />
                    <Input
                        ref={searchRef}
                        data-testid={`emoji-picker-search`}
                        value={query}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        placeholder={strings.searchPlaceholder}
                        aria-label={strings.searchAriaLabel}
                        className={`h-8 pr-8 pl-7 text-sm`}
                    />
                    {query.length > 0 && (
                        <button
                            type={`button`}
                            data-testid={`emoji-picker-clear`}
                            aria-label={strings.clearSearch}
                            onClick={() => setQuery(``)}
                            className={`text-muted-foreground hover:text-foreground absolute top-1/2 right-4 -translate-y-1/2`}
                        >
                            <X className={`h-3.5 w-3.5`} />
                        </button>
                    )}
                </div>
            )}

            {!showSearchResults && (
                <div
                    data-testid={`emoji-picker-categories`}
                    role={`tablist`}
                    className={`flex shrink-0 items-center justify-between border-b px-1`}
                >
                    <div className={`flex flex-1 items-center`}>
                        {EMOJI_CATEGORIES.map((cat) => {
                            const selected = cat.id === activeCategory;
                            return (
                                <button
                                    key={cat.id}
                                    type={`button`}
                                    role={`tab`}
                                    aria-selected={selected}
                                    aria-label={strings.categoryNames[cat.id]}
                                    title={strings.categoryNames[cat.id]}
                                    data-testid={`emoji-picker-category`}
                                    data-category={cat.id}
                                    // Suppress focus on click — see the
                                    // matching note on emoji cells.
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => {
                                        // Tab clicks both set the active
                                        // state and scroll the picker's
                                        // internal container — see
                                        // scrollCategoryIntoView for the
                                        // reason we don't use
                                        // Element.scrollIntoView.
                                        setActiveCategory(cat.id);
                                        scrollCategoryIntoView(cat.id);
                                    }}
                                    className={cn(
                                        `flex h-8 flex-1 items-center justify-center rounded-sm text-base transition-colors`,
                                        selected
                                            ? `text-foreground bg-accent`
                                            : `text-muted-foreground hover:text-foreground hover:bg-accent/60`
                                    )}
                                >
                                    {cat.iconEmoji}
                                </button>
                            );
                        })}
                    </div>
                    {!hideSkinTone && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    size={`icon-sm`}
                                    variant={`ghost`}
                                    aria-label={strings.skinToneAriaLabel}
                                    title={strings.skinToneAriaLabel}
                                    data-testid={`emoji-picker-skin-tone-trigger`}
                                    className={`shrink-0 text-base`}
                                >
                                    {applySkinTone(`✋`, skinTone)}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align={`end`}
                                data-testid={`emoji-picker-skin-tone-menu`}
                            >
                                {SKIN_TONE_SWATCHES.map((sw) => (
                                    <DropdownMenuItem
                                        key={sw.tone}
                                        data-testid={`emoji-picker-skin-tone-option`}
                                        data-tone={sw.tone}
                                        onSelect={() => setSkinTone(sw.tone)}
                                        className={cn(
                                            `gap-2`,
                                            sw.tone === skinTone && `bg-accent`
                                        )}
                                    >
                                        <span className={`text-base`}>{sw.emoji}</span>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            )}

            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className={`flex-1 overflow-y-auto p-2`}
                data-testid={`emoji-picker-scroll`}
            >
                {showSearchResults ? (
                    searchResults.length === 0 ? (
                        <div
                            data-testid={`emoji-picker-no-results`}
                            className={`text-muted-foreground p-4 text-center text-sm`}
                        >
                            {strings.noResults}
                        </div>
                    ) : (
                        <div
                            data-testid={`emoji-picker-search-results`}
                            className={`grid gap-1`}
                            style={gridStyle}
                            role={`grid`}
                        >
                            {searchResults.map((e) => renderEmojiButton(e, `s:${e.char}`))}
                        </div>
                    )
                ) : (
                    <div className={`flex flex-col gap-3`}>
                        {showRecents && (
                            <section
                                data-category-section={`recent`}
                                data-testid={`emoji-picker-recents`}
                            >
                                <h3
                                    className={`text-muted-foreground sticky top-0 z-10 mb-1 bg-card px-1 text-[10px] font-medium tracking-wide uppercase`}
                                >
                                    {strings.recent}
                                </h3>
                                <div
                                    className={`grid gap-1`}
                                    style={gridStyle}
                                    role={`grid`}
                                >
                                    {recents
                                        .map((c) => entriesByChar.get(c))
                                        .filter((e): e is EmojiEntry => e !== undefined)
                                        .map((e) => renderEmojiButton(e, `r:${e.char}`))}
                                </div>
                            </section>
                        )}
                        {EMOJI_CATEGORIES.map((cat) => {
                            const entries = emojisInCategory(cat.id);
                            return (
                                <section
                                    key={cat.id}
                                    data-category-section={cat.id}
                                    data-testid={`emoji-picker-section`}
                                >
                                    <h3
                                        className={`text-muted-foreground sticky top-0 z-10 mb-1 bg-card px-1 text-[10px] font-medium tracking-wide uppercase`}
                                    >
                                        {strings.categoryNames[cat.id]}
                                    </h3>
                                    <div
                                        className={`grid gap-1`}
                                        style={gridStyle}
                                        role={`grid`}
                                    >
                                        {entries.map((e) => renderEmojiButton(e, `${cat.id}:${e.char}`))}
                                    </div>
                                </section>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
});

EmojiPicker.displayName = `EmojiPicker`;

export default EmojiPicker;
export { SKIN_TONE_MODIFIERS };
