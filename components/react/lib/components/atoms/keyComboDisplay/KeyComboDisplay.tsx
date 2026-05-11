import { isMacPlatform } from "@/lib/mowsContext/HotkeyManager";
import { MowsContext } from "@/lib/mowsContext/MowsContext";
import { cn } from "@/lib/utils";
import { useContext, type CSSProperties } from "react";
import type { Translation } from "../../../lib/languages";

interface KeyComboDisplayProps {
    readonly keyCombo: string;
    readonly className?: string;
    readonly style?: CSSProperties;
}

const MAC_SYMBOLS: Record<string, string> = {
    mod: `⌘`,
    ctrl: `⌃`,
    alt: `⌥`,
    shift: `⇧`,
    meta: `⌘`,
    enter: `↵`,
    esc: `⎋`,
    tab: `⇥`,
    space: `␣`,
    backspace: `⌫`
};

const renderToken = (raw: string, translation: Translation, mac: boolean): string => {
    const lower = raw.trim().toLowerCase();
    if (mac && MAC_SYMBOLS[lower]) return MAC_SYMBOLS[lower];

    const keys = translation.keys;
    switch (lower) {
        case `mod`:
        case `ctrl`:
            return keys.ctrl;
        case `alt`:
            return keys.alt;
        case `shift`:
            return keys.shift;
        case `meta`:
            return keys.meta;
        case `enter`:
            return keys.enter;
        case `esc`:
            return keys.esc;
        case `tab`:
            return keys.tab;
        case `space`:
            return keys.space;
        case `backspace`:
            return keys.backspace;
        default:
            return raw.length === 1
                ? raw.toUpperCase()
                : raw.charAt(0).toUpperCase() + raw.slice(1);
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

    const mac = isMacPlatform();

    return (
        <div className={cn(`flex items-center gap-1`, className)} style={style}>
            {tokens.map((token, i) => (
                <span key={i} className={`flex items-center gap-1`}>
                    <kbd
                        className={`bg-muted text-muted-foreground pointer-events-none inline-flex items-center justify-center rounded border px-1.5 py-1 pt-1.5 font-mono text-[10px] leading-none font-medium opacity-100 select-none`}
                    >
                        {renderToken(token, mowsContext.t, mac)}
                    </kbd>
                    {i < tokens.length - 1 && (
                        <span className={`text-muted-foreground text-xs`}>+</span>
                    )}
                </span>
            ))}
        </div>
    );
};

export default KeyComboDisplay;
