// Single import boundary for shaka-player. The compiled bundle is heavy
// (~256 kB gzipped) and Shaka touches `MediaSource`/`navigator` at import
// time, so this module exists to (a) co-locate any default-vs-namespace
// import quirks and (b) make it trivial to vi.mock() in tests.
import shaka from "shaka-player";

let polyfillsInstalled = false;

export const ensurePolyfills = (): void => {
    if (polyfillsInstalled) return;
    shaka.polyfill.installAll();
    polyfillsInstalled = true;
};

export const isShakaSupported = (): boolean => shaka.Player.isBrowserSupported();

export { shaka };
export type ShakaPlayer = shaka.Player;
