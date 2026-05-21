import { useContext, useEffect, useRef, useState, type CSSProperties } from "react";
import KeyComboDisplay from "@/components/actions/keyComboDisplay/KeyComboDisplay";
import { Button } from "@/components/ui/button";
import { isMacPlatform } from "@/lib/mowsContext/HotkeyManager";
import { MowsContext } from "@/lib/mowsContext/MowsContext";
import { cn } from "@/lib/utils";

export interface KeyComboRecorderProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    /**
     * Fired every time a combo is captured — either a real combo on
     * keydown or a standalone modifier release. Useful for syncing
     * recorded combos into external state (e.g. driving a settings
     * editor) instead of relying on the built-in history list.
     */
    readonly onCombo?: (combo: string) => void;
}

const MODIFIER_KEYS = [`Shift`, `Control`, `Alt`, `Meta`];

/**
 * Captures live key combos from the keyboard and converts them to combo
 * strings via the same `HotkeyManager.formatKeyCombo` the rest of the
 * app uses. Renders its own start/stop button and a chronological list
 * of captured combos; consumers can also tap into raw combos via
 * `onCombo`.
 *
 * Modifier keys released alone (e.g. just Shift) are recorded as
 * standalone combos. A modifier that gets pressed and released while a
 * non-modifier key was struck in between is treated as part of that
 * combo and not recorded standalone.
 *
 * Must be rendered inside `<MowsProvider>` (uses the active
 * `HotkeyManager` for combo formatting and translations).
 */
export const KeyComboRecorder = ({ className, style, onCombo }: KeyComboRecorderProps) => {
    const ctx = useContext(MowsContext);
    if (!ctx) {
        throw new Error(`<KeyComboRecorder> must be rendered inside <MowsProvider>`);
    }
    const t = ctx.t.keyComboRecorder;
    const [recording, setRecording] = useState(false);
    const [combos, setCombos] = useState<ReadonlyArray<string>>([]);
    const nextIdRef = useRef(1);
    const onComboRef = useRef(onCombo);
    useEffect(() => {
        onComboRef.current = onCombo;
    }, [onCombo]);

    useEffect(() => {
        if (!recording) return;
        const modifierDownAt = new Map<string, number>();
        let lastNonModifierAt = 0;

        const modifierToken = (eventKey: string): string | null => {
            const mac = isMacPlatform();
            switch (eventKey) {
                case `Control`:
                    return mac ? `ctrl` : `mod`;
                case `Meta`:
                    return mac ? `mod` : `meta`;
                case `Alt`:
                    return `alt`;
                case `Shift`:
                    return `shift`;
                default:
                    return null;
            }
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (MODIFIER_KEYS.includes(event.key)) {
                if (!modifierDownAt.has(event.key)) {
                    modifierDownAt.set(event.key, performance.now());
                }
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            lastNonModifierAt = performance.now();
            const combo = ctx.hotkeyManager.formatKeyCombo(event);
            setCombos((prev) => [...prev, combo]);
            onComboRef.current?.(combo);
        };

        const onKeyUp = (event: KeyboardEvent) => {
            if (!MODIFIER_KEYS.includes(event.key)) return;
            const downAt = modifierDownAt.get(event.key);
            modifierDownAt.delete(event.key);
            if (downAt === undefined) return;
            if (lastNonModifierAt > downAt) return;
            const token = modifierToken(event.key);
            if (!token) return;
            setCombos((prev) => [...prev, token]);
            onComboRef.current?.(token);
        };

        const opts = { capture: true } as const;
        window.addEventListener(`keydown`, onKeyDown, opts);
        window.addEventListener(`keyup`, onKeyUp, opts);
        return () => {
            window.removeEventListener(`keydown`, onKeyDown, opts as EventListenerOptions);
            window.removeEventListener(`keyup`, onKeyUp, opts as EventListenerOptions);
        };
    }, [recording, ctx.hotkeyManager]);

    return (
        <div className={cn(`flex flex-col gap-2`, className)} style={style}>
            <div className={`text-sm font-semibold`}>{t.heading}</div>
            <p className={`text-muted-foreground text-xs`}>{t.hint}</p>
            <div className={`flex items-center gap-3`}>
                <Button
                    size={`sm`}
                    variant={recording ? `destructive` : `default`}
                    onClick={() => setRecording((r) => !r)}
                >
                    {recording ? t.stop : t.start}
                </Button>
                {combos.length > 0 && (
                    <Button
                        size={`sm`}
                        variant={`ghost`}
                        onClick={() => {
                            setCombos([]);
                            nextIdRef.current = 1;
                        }}
                    >
                        {t.clear}
                    </Button>
                )}
                {recording && (
                    <span className={`text-muted-foreground text-xs`}>{t.listening}</span>
                )}
            </div>
            {combos.length > 0 && (
                <ul
                    className={`mt-1 flex max-h-48 flex-col gap-1 overflow-auto rounded-md border bg-card p-2`}
                    data-testid={`keycombo-recorder-list`}
                >
                    {/* Newest first: iterate from the end of the press history.
                         The displayed press number still reflects the actual
                         chronological order (1 = first press). */}
                    {combos
                        .map((combo, i) => ({ combo, pressNumber: i + 1 }))
                        .reverse()
                        .map(({ combo, pressNumber }) => (
                            <li
                                key={`${pressNumber}-${combo}`}
                                className={`flex items-center gap-3`}
                            >
                                <span
                                    className={`text-muted-foreground w-6 shrink-0 text-right text-[10px] tabular-nums`}
                                >
                                    {pressNumber}
                                </span>
                                <KeyComboDisplay keyCombo={combo} />
                                <code className={`text-muted-foreground text-xs`}>{combo}</code>
                            </li>
                        ))}
                </ul>
            )}
        </div>
    );
};

export default KeyComboRecorder;
