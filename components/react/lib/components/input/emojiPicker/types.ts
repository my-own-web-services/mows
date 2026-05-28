import type { CSSProperties } from "react";
import type {
    EmojiCategoryId,
    EmojiEntry,
    SkinToneIndex
} from "./emojiData";

export interface EmojiPickerStrings {
    readonly searchPlaceholder: string;
    readonly searchAriaLabel: string;
    readonly recent: string;
    readonly noResults: string;
    readonly skinToneAriaLabel: string;
    readonly clearSearch: string;
    readonly categoryNames: Readonly<Record<EmojiCategoryId, string>>;
}

export const DEFAULT_EMOJI_PICKER_STRINGS: EmojiPickerStrings = {
    searchPlaceholder: `Search emojis…`,
    searchAriaLabel: `Search emojis`,
    recent: `Recently used`,
    noResults: `No emojis match this search.`,
    skinToneAriaLabel: `Skin tone`,
    clearSearch: `Clear search`,
    categoryNames: {
        smileys: `Smileys & emotion`,
        people: `People & body`,
        animals: `Animals & nature`,
        food: `Food & drink`,
        activities: `Activities`,
        travel: `Travel & places`,
        objects: `Objects`,
        symbols: `Symbols`,
        flags: `Flags`
    }
};

export interface EmojiPickerProps {
    /** Fires with the selected emoji string (already skin-toned). */
    readonly onSelect: (emoji: string, entry: EmojiEntry) => void;
    /** Optional: invoked when the user hits Escape inside the picker. */
    readonly onClose?: () => void;
    /** Renders the picker without the recent-emojis row. */
    readonly hideRecent?: boolean;
    /** Renders the picker without the search bar. */
    readonly hideSearch?: boolean;
    /** Renders the picker without the skin-tone toggle. */
    readonly hideSkinTone?: boolean;
    /** Controlled skin tone. Falls back to internal state when omitted. */
    readonly skinTone?: SkinToneIndex;
    readonly onSkinToneChange?: (tone: SkinToneIndex) => void;
    /** Number of emoji columns rendered in the grid. Defaults to 9. */
    readonly columns?: number;
    /** Max number of recents kept in localStorage. Defaults to 24. */
    readonly maxRecent?: number;
    /**
     * localStorage key prefix used for recent-emoji persistence + skin
     * tone preference. Per-app namespacing keeps two different apps from
     * stomping each other's recents when both live on the same origin.
     * Set to `null` to disable persistence entirely.
     */
    readonly storagePrefix?: string | null;
    readonly strings?: Partial<EmojiPickerStrings>;
    readonly className?: string;
    readonly style?: CSSProperties;
    /** Overall height in pixels. Defaults to 360. */
    readonly height?: number;
}
