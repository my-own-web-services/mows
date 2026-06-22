import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EmojiPicker from "./EmojiPicker";
import { applySkinTone, EMOJI_DATA, searchEmojis } from "./emojiData";

const findCellByEmoji = (container: HTMLElement, baseChar: string): HTMLButtonElement | null => {
    // CSS attribute selectors with emoji code points are unreliable in
    // jsdom; filter via the dataset instead so we get a stable match.
    const cells = Array.from(
        container.querySelectorAll<HTMLButtonElement>(`[data-testid="emoji-cell"]`)
    );
    return cells.find((c) => c.dataset.emoji === baseChar) ?? null;
};

beforeEach(() => {
    window.localStorage.clear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe(`EmojiPicker dataset`, () => {
    it(`contains entries across every category`, () => {
        const categories = new Set(EMOJI_DATA.map((e) => e.category));
        expect(categories.size).toBeGreaterThanOrEqual(9);
    });

    it(`searchEmojis filters by name`, () => {
        const results = searchEmojis(`grinning`);
        expect(results.length).toBeGreaterThan(0);
        // Search spans name + keywords (the haystack), so a name-query can also
        // surface emoji that merely carry the term as a tag.
        expect(
            results.every((r) => `${r.name} ${r.keywords.join(` `)}`.includes(`grinning`))
        ).toBe(true);
        // At least one true name hit (e.g. "grinning face") is present.
        expect(results.some((r) => r.name.includes(`grinning`))).toBe(true);
    });

    it(`searchEmojis matches keywords across tokens (AND semantics)`, () => {
        // "happy smile" should narrow to entries whose haystack contains
        // both tokens — not the union.
        const single = searchEmojis(`happy`);
        const both = searchEmojis(`happy smile`);
        expect(both.length).toBeLessThanOrEqual(single.length);
        expect(both.length).toBeGreaterThan(0);
        const haystackHasBoth = both.every((r) => {
            const text = `${r.name} ${r.keywords.join(` `)}`;
            return text.includes(`happy`) && text.includes(`smile`);
        });
        expect(haystackHasBoth).toBe(true);
    });

    it(`searchEmojis returns nothing for an empty query`, () => {
        expect(searchEmojis(``)).toEqual([]);
        expect(searchEmojis(`   `)).toEqual([]);
    });

    it(`applySkinTone leaves non-skin emojis unchanged`, () => {
        // The cat is not in the skin-tone set; the function still accepts
        // the call (cells render it uniformly) but the output equals the
        // input.
        expect(applySkinTone(`🐱`, 3)).toBe(`🐱`);
    });

    it(`applySkinTone appends the Fitzpatrick modifier for skin-tone emojis`, () => {
        const out = applySkinTone(`👋`, 4);
        expect(out).toBe(`👋\u{1F3FE}`);
    });

    it(`tone 0 returns the bare base char`, () => {
        expect(applySkinTone(`👋`, 0)).toBe(`👋`);
    });
});

describe(`EmojiPicker`, () => {
    it(`renders the picker shell with search + categories`, () => {
        render(<EmojiPicker onSelect={vi.fn()} />);
        expect(screen.getByTestId(`emoji-picker`)).toBeInTheDocument();
        expect(screen.getByTestId(`emoji-picker-search`)).toBeInTheDocument();
        expect(screen.getByTestId(`emoji-picker-categories`)).toBeInTheDocument();
    });

    it(`hides the search bar when hideSearch is true`, () => {
        render(<EmojiPicker onSelect={vi.fn()} hideSearch />);
        expect(screen.queryByTestId(`emoji-picker-search`)).not.toBeInTheDocument();
    });

    it(`hides the skin-tone toggle when hideSkinTone is true`, () => {
        render(<EmojiPicker onSelect={vi.fn()} hideSkinTone />);
        expect(
            screen.queryByTestId(`emoji-picker-skin-tone-trigger`)
        ).not.toBeInTheDocument();
    });

    it(`fires onSelect with the picked emoji string`, () => {
        const onSelect = vi.fn();
        const { container } = render(<EmojiPicker onSelect={onSelect} />);
        const cell = findCellByEmoji(container, `😀`);
        expect(cell).not.toBeNull();
        fireEvent.click(cell!);
        expect(onSelect).toHaveBeenCalledTimes(1);
        expect(onSelect.mock.calls[0]![0]).toBe(`😀`);
        expect(onSelect.mock.calls[0]![1]).toMatchObject({
            char: `😀`,
            category: `smileys`
        });
    });

    it(`applies the active skin tone to skin-toneable emojis`, () => {
        const onSelect = vi.fn();
        const { container } = render(
            <EmojiPicker onSelect={onSelect} skinTone={3} hideSkinTone />
        );
        const wave = findCellByEmoji(container, `👋`);
        expect(wave).not.toBeNull();
        fireEvent.click(wave!);
        expect(onSelect.mock.calls[0]![0]).toBe(`👋\u{1F3FD}`);
    });

    it(`searching narrows the result set to a flat grid`, () => {
        const { container } = render(<EmojiPicker onSelect={vi.fn()} />);
        const search = screen.getByTestId(`emoji-picker-search`) as HTMLInputElement;
        fireEvent.change(search, { target: { value: `grinning` } });
        expect(screen.getByTestId(`emoji-picker-search-results`)).toBeInTheDocument();
        expect(screen.queryByTestId(`emoji-picker-categories`)).not.toBeInTheDocument();
        const cells = container.querySelectorAll(`[data-testid="emoji-cell"]`);
        expect(cells.length).toBeGreaterThan(0);
    });

    it(`shows the no-results state for an unmatched query`, () => {
        render(<EmojiPicker onSelect={vi.fn()} />);
        const search = screen.getByTestId(`emoji-picker-search`) as HTMLInputElement;
        fireEvent.change(search, { target: { value: `__definitelynothere__` } });
        expect(screen.getByTestId(`emoji-picker-no-results`)).toBeInTheDocument();
    });

    it(`Enter inside the search input picks the first result`, () => {
        const onSelect = vi.fn();
        render(<EmojiPicker onSelect={onSelect} />);
        const search = screen.getByTestId(`emoji-picker-search`) as HTMLInputElement;
        fireEvent.change(search, { target: { value: `grinning` } });
        fireEvent.keyDown(search, { key: `Enter` });
        expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it(`Escape clears the query before invoking onClose`, () => {
        const onClose = vi.fn();
        render(<EmojiPicker onSelect={vi.fn()} onClose={onClose} />);
        const search = screen.getByTestId(`emoji-picker-search`) as HTMLInputElement;
        fireEvent.change(search, { target: { value: `grinning` } });
        fireEvent.keyDown(search, { key: `Escape` });
        // First Escape clears the query
        expect(search.value).toBe(``);
        expect(onClose).not.toHaveBeenCalled();
        // Second Escape invokes onClose
        fireEvent.keyDown(search, { key: `Escape` });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it(`persists picked emojis to localStorage under the storagePrefix`, () => {
        const onSelect = vi.fn();
        const { container } = render(
            <EmojiPicker onSelect={onSelect} storagePrefix={`test-prefix`} />
        );
        const cell = findCellByEmoji(container, `🎉`);
        fireEvent.click(cell!);
        const stored = JSON.parse(window.localStorage.getItem(`test-prefix-recent`)!);
        expect(stored).toEqual([`🎉`]);
    });

    it(`does not touch storage when storagePrefix is null`, () => {
        const { container } = render(
            <EmojiPicker onSelect={vi.fn()} storagePrefix={null} />
        );
        const cell = findCellByEmoji(container, `🎉`);
        fireEvent.click(cell!);
        expect(window.localStorage.length).toBe(0);
    });

    it(`dedupes the recents row by base character`, () => {
        const { container } = render(
            <EmojiPicker onSelect={vi.fn()} storagePrefix={`test-prefix`} />
        );
        const cell = findCellByEmoji(container, `🎉`);
        fireEvent.click(cell!);
        fireEvent.click(cell!);
        const stored = JSON.parse(window.localStorage.getItem(`test-prefix-recent`)!);
        // Even after two clicks, the same emoji only appears once in the
        // recents list — pushing the same char to the front dedupes.
        expect(stored).toEqual([`🎉`]);
    });

    it(`renders a recents section once an emoji has been picked`, () => {
        const { container, rerender } = render(
            <EmojiPicker onSelect={vi.fn()} storagePrefix={`test-prefix`} />
        );
        const cell = findCellByEmoji(container, `🎉`);
        fireEvent.click(cell!);
        // Force a re-render so the picker reads from updated state.
        rerender(<EmojiPicker onSelect={vi.fn()} storagePrefix={`test-prefix`} />);
        expect(screen.getByTestId(`emoji-picker-recents`)).toBeInTheDocument();
    });

    it(`uses the controlled skinTone prop when provided`, () => {
        const onSelect = vi.fn();
        const { container, rerender } = render(
            <EmojiPicker onSelect={onSelect} skinTone={1} />
        );
        const wave = findCellByEmoji(container, `👋`);
        fireEvent.click(wave!);
        expect(onSelect.mock.calls[0]![0]).toBe(`👋\u{1F3FB}`);
        // Re-render with a different controlled tone — the next selection
        // picks up the new value without any internal state involvement.
        onSelect.mockClear();
        rerender(<EmojiPicker onSelect={onSelect} skinTone={5} />);
        const wave2 = findCellByEmoji(container, `👋`);
        fireEvent.click(wave2!);
        expect(onSelect.mock.calls[0]![0]).toBe(`👋\u{1F3FF}`);
    });

    it(`exposes a configurable column count via the grid style`, () => {
        const { container } = render(<EmojiPicker onSelect={vi.fn()} columns={6} />);
        const grid = container.querySelector(`[role="grid"]`) as HTMLDivElement;
        expect(grid.style.gridTemplateColumns).toBe(`repeat(6, minmax(0, 1fr))`);
    });

    it(`clicking the clear-search button empties the query`, () => {
        render(<EmojiPicker onSelect={vi.fn()} />);
        const search = screen.getByTestId(`emoji-picker-search`) as HTMLInputElement;
        fireEvent.change(search, { target: { value: `cat` } });
        const clear = screen.getByTestId(`emoji-picker-clear`);
        fireEvent.click(clear);
        expect(search.value).toBe(``);
    });
});
