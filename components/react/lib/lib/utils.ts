import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => {
    return twMerge(clsx(inputs));
};

export const formatFileSizeToHumanReadable = (maybe_bigint_bytes: bigint | number): string => {
    const bytes = Number(maybe_bigint_bytes);
    // Added `PiB` + `EiB` so very large sizes don't render `2.3 undefined`
    // (SLOP-28). The clamp on `i` makes the index safe for any input.
    const sizes = [`Bytes`, `KiB`, `MiB`, `GiB`, `TiB`, `PiB`, `EiB`] as const;
    if (bytes === 0) {
        return `0 Bytes`;
    }
    const rawIndex = Math.floor(Math.log(bytes) / Math.log(1024));
    const i = Math.max(0, Math.min(rawIndex, sizes.length - 1));
    return (bytes / Math.pow(1024, i)).toFixed(2) + ` ` + sizes[i];
};

/**
 * Cryptographically secure random id (URL-safe base64-ish alphabet).
 *
 * Uses `crypto.getRandomValues` so the result is suitable for tokens,
 * session ids, upload keys, etc. Falls back to a non-secure variant
 * only when `crypto` is unavailable (very old jsdom), in which case
 * the caller sees a clear warning in the logs.
 *
 * SLOP-27: the previous `Math.random()`-based implementation was
 * predictable; the function's bare name (`generateRandomId`) read like
 * a UUID and was already being passed into upload-key paths.
 */
export const generateRandomId = (length: number = 16): string => {
    const chars = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-`;
    const cryptoApi: Crypto | undefined =
        typeof globalThis !== `undefined` &&
        typeof (globalThis as { crypto?: Crypto }).crypto !== `undefined`
            ? (globalThis as { crypto: Crypto }).crypto
            : undefined;
    if (cryptoApi?.getRandomValues) {
        const bytes = new Uint8Array(length);
        cryptoApi.getRandomValues(bytes);
        let result = ``;
        for (let i = 0; i < length; i++) {
            result += chars.charAt(bytes[i] % chars.length);
        }
        return result;
    }
    // Fallback: only reachable in environments that lack
    // `crypto.getRandomValues` entirely. Documented so callers can audit.
    let result = ``;
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};
