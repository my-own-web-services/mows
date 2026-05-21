import { MowsContext } from "@/lib/mowsContext/MowsContext";
import { cn } from "@/lib/utils";
import {
    ArrowBigDown,
    ArrowBigUp,
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    ArrowRightToLine,
    ArrowUp,
    ChevronUp,
    Command,
    CornerDownLeft,
    Delete,
    Globe,
    MenuSquare,
    Option,
    type LucideIcon
} from "lucide-react";
import { useContext, type CSSProperties, type ReactNode } from "react";
import type { Translation } from "../../../lib/languages";

interface KeyComboDisplayProps {
    readonly keyCombo: string;
    readonly className?: string;
    readonly style?: CSSProperties;
}

// Universal keycap icons — every keyboard prints these symbols on the
// physical keys, so we use them across platforms and languages. Keys with
// localized text labels (Home → "Pos1" in German, etc.) deliberately live
// in the translated `keys.*` table instead.
const UNIVERSAL_ICONS: Record<string, LucideIcon> = {
    shift: ArrowBigUp,
    enter: CornerDownLeft,
    return: CornerDownLeft,
    tab: ArrowRightToLine,
    backspace: Delete,
    capslock: ArrowBigDown,
    arrowup: ArrowUp,
    up: ArrowUp,
    arrowdown: ArrowDown,
    down: ArrowDown,
    arrowleft: ArrowLeft,
    left: ArrowLeft,
    arrowright: ArrowRight,
    right: ArrowRight,
    // The "Menu" / "Context-Menu" / "Application" key — physical key to
    // the left of right-Ctrl on most PC keyboards. Same key, several
    // common token names; all map to the menu glyph.
    menu: MenuSquare,
    contextmenu: MenuSquare,
    application: MenuSquare,
    apps: MenuSquare
};

// Modifier-key icons that only appear on Apple keyboards. On non-Apple
// platforms these fall through to the translated word ("Strg", "Alt", …).
const MAC_MODIFIER_ICONS: Record<string, LucideIcon> = {
    mod: Command,
    meta: Command,
    cmd: Command,
    command: Command,
    ctrl: ChevronUp,
    control: ChevronUp,
    alt: Option,
    option: Option
};

interface RenderedToken {
    readonly icon: LucideIcon | null;
    readonly text: string | null;
    /** Optional trailing icon — e.g. PageUp renders text + ↑ arrow. */
    readonly iconAfter?: LucideIcon;
}

const renderToken = (raw: string, translation: Translation, mac: boolean): RenderedToken => {
    const lower = raw.trim().toLowerCase();

    const universal = UNIVERSAL_ICONS[lower];
    if (universal) return { icon: universal, text: null };

    if (mac) {
        const macIcon = MAC_MODIFIER_ICONS[lower];
        if (macIcon) return { icon: macIcon, text: null };
    }

    const keys = translation.keys;
    switch (lower) {
        case `mod`:
        case `ctrl`:
            return { icon: null, text: keys.ctrl };
        case `alt`:
            return { icon: null, text: keys.alt };
        case `altgr`:
        case `alt-gr`:
        case `alt_gr`:
            return { icon: null, text: keys.altgr };
        case `fn`:
        case `function`:
        case `globe`:
            return { icon: null, text: keys.fn };
        case `meta`:
            return { icon: null, text: keys.meta };
        case `space`:
            return { icon: null, text: keys.space };
        case `esc`:
        case `escape`:
            return { icon: null, text: keys.esc };
        case `del`:
        case `delete`:
            return { icon: null, text: keys.del };
        case `ins`:
        case `insert`:
            return { icon: null, text: keys.insert };
        case `home`:
            return { icon: null, text: keys.home };
        case `end`:
            return { icon: null, text: keys.end };
        case `pageup`:
        case `pgup`:
            return { icon: null, text: keys.pageUp, iconAfter: ArrowUp };
        case `pagedown`:
        case `pgdn`:
            return { icon: null, text: keys.pageDown, iconAfter: ArrowDown };
        case `pause`:
        case `break`:
            return { icon: null, text: keys.pause };
        case `scrolllock`:
        case `scroll`:
        case `scrlk`:
            return { icon: null, text: keys.scrollLock };
        case `numlock`:
        case `num`:
        case `numlk`:
            return { icon: null, text: keys.numLock, iconAfter: ArrowDown };
        case `printscreen`:
        case `prtsc`:
        case `prtscr`:
        case `print`:
            return { icon: null, text: keys.printScreen };
        default: {
            const text =
                raw.length === 1
                    ? raw.toUpperCase()
                    : raw.charAt(0).toUpperCase() + raw.slice(1);
            return { icon: null, text };
        }
    }
};

export const KeyComboDisplay = ({ keyCombo, className, style }: KeyComboDisplayProps) => {
    const mowsContext = useContext(MowsContext);
    if (!mowsContext) return null;

    // Accept both raw combos ("mod+shift+p") and the parseKeyCombo-formatted
    // form ("Mod + Shift + P") so existing call sites keep working.
    const tokens = keyCombo
        .split(`+`)
        .map((token) => token.trim())
        .filter(Boolean);
    if (tokens.length === 0) return null;

    // Always render the Win / Linux variant. macOS-specific glyphs (⌘, ⌃,
    // ⌥) are documented separately via `MAC_MODIFIER_DIFFERENCES` so docs /
    // cheat-sheets can show one row per shortcut and a single legend
    // section listing the macOS equivalents.
    const rendered = tokens.map((t) => renderToken(t, mowsContext.t, false));

    return (
        <div className={cn(`flex items-center gap-1`, className)} style={style}>
            {rendered.map(({ icon: Icon, text, iconAfter: IconAfter }, i) => {
                const inner: ReactNode = Icon ? (
                    <Icon className={`h-3! w-3!`} aria-hidden />
                ) : (
                    <span className={`inline-flex items-center gap-0.5 leading-none`}>
                        <span>{text}</span>
                        {IconAfter && <IconAfter className={`h-3! w-3!`} aria-hidden />}
                    </span>
                );
                return (
                    <span key={i} className={`flex items-center gap-1`}>
                        <kbd
                            className={cn(
                                `bg-muted text-muted-foreground pointer-events-none inline-flex h-5 min-w-5 items-center justify-center gap-1 rounded border px-1.5 leading-none font-medium opacity-100 select-none`,
                                Icon ? `` : `font-mono text-[10px]`
                            )}
                        >
                            {inner}
                        </kbd>
                        {i < rendered.length - 1 && (
                            <span className={`text-muted-foreground text-xs`}>+</span>
                        )}
                    </span>
                );
            })}
        </div>
    );
};

/**
 * Public list of keys whose macOS rendering (icon glyph) differs from the
 * Win / Linux rendering (translated text). One entry per distinct icon,
 * each carrying the single canonical keycode — additional aliases
 * (`meta`/`cmd`/`command` for `mod`, `control` for `ctrl`,
 * `option` for `alt`) are accepted as combo tokens by `renderToken` but
 * intentionally omitted from this legend.
 */
export interface MacModifierDifference {
    /** Canonical combo token. */
    readonly token: string;
    /** Lucide icon shown on macOS keyboards. */
    readonly icon: LucideIcon;
}

export const MAC_MODIFIER_DIFFERENCES: ReadonlyArray<MacModifierDifference> = [
    { token: `mod`, icon: Command },
    { token: `ctrl`, icon: ChevronUp },
    { token: `alt`, icon: Option },
    // Apple's dedicated 🌐 / Globe key (lower-left of modern Mac keyboards),
    // which doubles as Fn. Renders as plain "Fn" text on Win / Linux.
    { token: `fn`, icon: Globe }
];

export default KeyComboDisplay;
