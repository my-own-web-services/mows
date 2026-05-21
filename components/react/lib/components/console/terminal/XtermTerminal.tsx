import type { MowsCodeTheme } from "@/lib/codeThemes";
import { useMows } from "@/lib/mowsContext/MowsContext";
import { cn } from "@/lib/utils";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal as Xterm, type ITheme } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import * as React from "react";
import type { TerminalHandle, TerminalProps } from "./Terminal";
import { buildXtermThemeFromCodeTheme } from "./xtermTheme";

const FONT_FAMILY = `ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, "Cascadia Mono", "Liberation Mono", Consolas, "Courier New", monospace`;

// Resolve a Tailwind v4 "--color-*" CSS variable on the project's theme into
// a concrete color string xterm can consume. We probe via a detached element
// because xterm's color parser does not understand oklch() / lab() / etc. —
// the browser converts to rgb() in `getComputedStyle().color`, which xterm
// parses cleanly. Used only as a last-resort fallback when the active code
// theme ships no `colors` map.
const resolveCssVar = (cssVar: string, fallback: string): string => {
    if (typeof document === `undefined`) return fallback;
    const probe = document.createElement(`span`);
    probe.style.color = `var(${cssVar})`;
    probe.style.display = `none`;
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    document.body.removeChild(probe);
    return resolved && resolved !== `` ? resolved : fallback;
};

const buildXtermTheme = (codeTheme: MowsCodeTheme | undefined): ITheme =>
    buildXtermThemeFromCodeTheme(codeTheme, {
        background: resolveCssVar(`--color-background`, `#0b0b0b`),
        foreground: resolveCssVar(`--color-foreground`, `#e6e6e6`),
        selection: resolveCssVar(`--color-accent`, `#3f3f3f`)
    });

const XtermTerminal = React.forwardRef<TerminalHandle, TerminalProps>(
    ({ className, style, onData, onResize, onReady, fontSize = 13 }, forwardedRef) => {
        const mowsContext = useMows();
        const containerRef = React.useRef<HTMLDivElement>(null);
        const termRef = React.useRef<Xterm | null>(null);
        const fitRef = React.useRef<FitAddon | null>(null);

        // The terminal follows the *code* theme (VS Code parity), not the
        // app/workbench theme. We still combine the workbench theme id into
        // the change signal so the CSS-var fallbacks (used when a code theme
        // ships no `colors`) refresh too.
        const codeTheme = mowsContext?.currentCodeTheme;
        const codeThemeId = codeTheme?.id ?? `default`;
        const workbenchThemeId = mowsContext?.currentTheme.id ?? `default`;
        const themeSignal = `${codeThemeId}|${workbenchThemeId}`;
        const [themeColors, setThemeColors] = React.useState<ITheme>(() =>
            buildXtermTheme(codeTheme)
        );

        // Imperative handle exposes write/clear/focus/fit so consumers can
        // pump server output in without re-rendering React on every chunk.
        React.useImperativeHandle(
            forwardedRef,
            (): TerminalHandle => ({
                write: (data) => termRef.current?.write(data),
                writeln: (data) => termRef.current?.writeln(data),
                clear: () => termRef.current?.clear(),
                focus: () => termRef.current?.focus(),
                fit: () => fitRef.current?.fit()
            }),
            []
        );

        // Initialize xterm exactly once.
        React.useEffect(() => {
            const container = containerRef.current;
            if (!container) return;

            const term = new Xterm({
                fontFamily: FONT_FAMILY,
                fontSize,
                cursorBlink: true,
                convertEol: true,
                theme: themeColors,
                allowProposedApi: false
            });
            const fit = new FitAddon();
            term.loadAddon(fit);
            term.open(container);
            // Defer the first fit() until the layout has settled — calling it
            // synchronously before the container has a real size produces 0
            // cols/rows and makes xterm refuse to render anything.
            requestAnimationFrame(() => {
                try {
                    fit.fit();
                } catch {
                    // ignore — container not yet measurable
                }
            });

            const dataDisposable = term.onData((d) => onDataRef.current?.(d));
            const resizeDisposable = term.onResize(({ cols, rows }) =>
                onResizeRef.current?.(cols, rows)
            );

            termRef.current = term;
            fitRef.current = fit;

            // Notify the consumer once xterm is mounted so they can write a
            // banner / prompt without their own mount-effect race against
            // the lazy chunk load.
            onReadyRef.current?.({
                write: (data) => term.write(data),
                writeln: (data) => term.writeln(data),
                clear: () => term.clear(),
                focus: () => term.focus(),
                fit: () => fit.fit()
            });

            const ro = new ResizeObserver(() => {
                try {
                    fit.fit();
                } catch {
                    // container removed mid-frame, etc.
                }
            });
            ro.observe(container);

            return () => {
                ro.disconnect();
                dataDisposable.dispose();
                resizeDisposable.dispose();
                term.dispose();
                termRef.current = null;
                fitRef.current = null;
            };
            // We deliberately omit themeMode / fontSize from deps — those are
            // applied via the `options` setter in the effect below to avoid
            // tearing down the whole xterm instance on every theme change.
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);

        // Keep the latest callback references in refs so the bootstrap
        // effect above doesn't have to depend on (and re-run for) them.
        const onDataRef = React.useRef(onData);
        const onResizeRef = React.useRef(onResize);
        const onReadyRef = React.useRef(onReady);
        React.useEffect(() => {
            onDataRef.current = onData;
        }, [onData]);
        React.useEffect(() => {
            onResizeRef.current = onResize;
        }, [onResize]);
        React.useEffect(() => {
            onReadyRef.current = onReady;
        }, [onReady]);

        // React to theme changes: re-resolve the active code theme colors
        // (with CSS-var fallbacks) and push the new palette into the live
        // xterm instance (no remount).
        React.useEffect(() => {
            // Defer one frame so the .theme-* class swap on <html> /
            // mowsContext root has actually applied before we read CSS vars.
            const id = requestAnimationFrame(() => {
                const next = buildXtermTheme(codeTheme);
                setThemeColors(next);
                const term = termRef.current;
                if (term) term.options.theme = next;
            });
            return () => cancelAnimationFrame(id);
            // codeTheme is intentionally absent — themeSignal already
            // captures the relevant id change without forcing a re-resolve
            // on every parent re-render that hands us a new object identity.
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [themeSignal]);

        React.useEffect(() => {
            const term = termRef.current;
            if (!term) return;
            term.options.fontSize = fontSize;
            try {
                fitRef.current?.fit();
            } catch {
                // ignore
            }
        }, [fontSize]);

        return (
            <div
                // The terminal renders as a flat unframed canvas — the host
                // (ConsoleManager pane, a doc demo wrapper, …) owns any
                // rounding, border, padding, or shadow. This mirrors how
                // VS Code's panel chrome owns the frame around the embedded
                // xterm. The background tracks the active code theme so the
                // outer surface and the xterm canvas can never diverge.
                style={{ backgroundColor: themeColors.background, ...style }}
                className={cn(
                    `Terminal h-full w-full overflow-hidden`,
                    className
                )}
            >
                <div ref={containerRef} className={`h-full w-full`} />
            </div>
        );
    }
);

XtermTerminal.displayName = `XtermTerminal`;

export default XtermTerminal;
