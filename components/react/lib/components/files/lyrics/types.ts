export interface LyricsWord {
    /** Seconds, relative to the audio source. */
    readonly time: number;
    readonly text: string;
}

export interface LyricsLine {
    /** Seconds, relative to the audio source. */
    readonly time: number;
    /** End time of the line. Inferred from the next line's start or the
     * length metadata when absent. */
    readonly endTime?: number;
    readonly text: string;
    /** Karaoke-style word-level timings, when the source uses enhanced
     * LRC `<mm:ss.xx>` markers between words. */
    readonly words?: ReadonlyArray<LyricsWord>;
}

export interface LyricsMetadata {
    readonly title?: string;
    readonly artist?: string;
    readonly album?: string;
    readonly author?: string;
    readonly creator?: string;
    /** `[length:mm:ss]` raw value. */
    readonly length?: string;
    /** `[offset:ms]` — milliseconds added to every timestamp. Positive
     * values shift lyrics earlier, mirroring the LRC spec. */
    readonly offset?: number;
}

export interface ParsedLyrics {
    readonly lines: ReadonlyArray<LyricsLine>;
    readonly metadata: LyricsMetadata;
}

export type LyricsVariant = `scrolling` | `compact`;

export interface LyricsStrings {
    readonly empty: string;
    readonly noTimings: string;
    readonly seekToLine: string;
    readonly title: string;
}

export const DEFAULT_LYRICS_STRINGS: LyricsStrings = {
    empty: `No lyrics`,
    noTimings: `Lyrics provided without timings`,
    seekToLine: `Seek to line`,
    title: `Lyrics`
};

// Leading-timestamp prefix matcher. LRC spec allows tags like `[mm:ss.xx]`,
// `[mm:ss.xxx]`, and `[mm:ss]` (no fractional component). The same line can
// carry multiple timestamps when the same lyric repeats — we walk these
// off the front of the line until none remain.
const LINE_TIMESTAMP = /^\[(\d+):(\d{1,2}(?:[.:]\d{1,3})?)\]/;

// Enhanced LRC karaoke marker placed inline between words: `<mm:ss.xx>`.
const WORD_TIMESTAMP = /<(\d+):(\d{1,2}(?:[.:]\d{1,3})?)>/g;

// `[ti:Title]`, `[ar:Artist]`, etc. Only matches when the bracketed
// content has no leading digit-then-colon (which is the timestamp shape),
// so a stray `[00:30]` on its own line never confuses metadata.
const METADATA = /^\[([a-zA-Z]{2,8}):\s*(.*)\]$/;

const parseSeconds = (minutes: string, secondsAndFraction: string): number => {
    // LRC variants in the wild use both `mm:ss.xxx` (dot) and the rarer
    // `mm:ss:xxx` (colon) — accept either by normalising the separator
    // before the parseFloat.
    const normalised = secondsAndFraction.replace(`:`, `.`);
    const m = Number.parseInt(minutes, 10);
    const s = Number.parseFloat(normalised);
    if (!Number.isFinite(m) || !Number.isFinite(s)) return Number.NaN;
    return m * 60 + s;
};

const isMetadataKey = (key: string): key is `ti` | `ar` | `al` | `au` | `by` | `length` | `offset` | `re` | `ve` => {
    return [`ti`, `ar`, `al`, `au`, `by`, `length`, `offset`, `re`, `ve`].includes(key.toLowerCase());
};

/**
 * Parse a string of LRC-formatted lyrics into a structured
 * `{ lines, metadata }` shape. The parser is forgiving: lines that don't
 * carry a timestamp are skipped, malformed timestamps are dropped, and
 * the result is always returned sorted by `time` ascending.
 *
 * Both classic LRC (`[mm:ss.xx] text`) and enhanced LRC with word-level
 * karaoke markers (`[mm:ss.xx] <mm:ss.xx> word <mm:ss.xx> word2`) are
 * recognised. Repeated timestamps on a single line — for choruses — are
 * expanded into separate `LyricsLine` entries.
 */
export const parseLrc = (raw: string): ParsedLyrics => {
    const lines: LyricsLine[] = [];
    const metadata: {
        title?: string;
        artist?: string;
        album?: string;
        author?: string;
        creator?: string;
        length?: string;
        offset?: number;
    } = {};

    for (const rawLine of raw.split(/\r?\n/)) {
        const trimmed = rawLine.trim();
        if (trimmed.length === 0) continue;

        // Pull leading timestamps off the front. Each iteration removes
        // one `[mm:ss.xx]` from `remaining` and records the second value.
        const stamps: number[] = [];
        let remaining = trimmed;
        while (true) {
            const match = LINE_TIMESTAMP.exec(remaining);
            if (!match) break;
            const seconds = parseSeconds(match[1], match[2]);
            if (Number.isFinite(seconds)) stamps.push(seconds);
            remaining = remaining.slice(match[0].length).trimStart();
        }

        if (stamps.length === 0) {
            // No leading timestamp — try metadata. Skip anything that
            // doesn't look like `[key:value]` so trailing prose text is
            // silently dropped rather than crashing the parse.
            const metaMatch = METADATA.exec(trimmed);
            if (!metaMatch) continue;
            const key = metaMatch[1].toLowerCase();
            if (!isMetadataKey(key)) continue;
            const value = metaMatch[2].trim();
            switch (key) {
                case `ti`:
                    metadata.title = value;
                    break;
                case `ar`:
                    metadata.artist = value;
                    break;
                case `al`:
                    metadata.album = value;
                    break;
                case `au`:
                    metadata.author = value;
                    break;
                case `by`:
                    metadata.creator = value;
                    break;
                case `length`:
                    metadata.length = value;
                    break;
                case `offset`: {
                    const parsed = Number.parseInt(value, 10);
                    if (Number.isFinite(parsed)) metadata.offset = parsed;
                    break;
                }
                default:
                    break;
            }
            continue;
        }

        // Walk word-level karaoke markers. Capture both the position in
        // the trimmed remainder and the timestamp so the slice between
        // adjacent markers becomes one word.
        const wordMatches: Array<{ index: number; length: number; time: number }> = [];
        const reset = new RegExp(WORD_TIMESTAMP.source, `g`);
        let m: RegExpExecArray | null;
        while ((m = reset.exec(remaining)) !== null) {
            const seconds = parseSeconds(m[1], m[2]);
            if (Number.isFinite(seconds)) {
                wordMatches.push({ index: m.index, length: m[0].length, time: seconds });
            }
        }

        let plainText: string;
        let words: LyricsWord[] | undefined;
        if (wordMatches.length > 0) {
            plainText = remaining.replace(WORD_TIMESTAMP, ``).replace(/\s+/g, ` `).trim();
            words = [];
            for (let i = 0; i < wordMatches.length; i++) {
                const start = wordMatches[i].index + wordMatches[i].length;
                const end = i + 1 < wordMatches.length ? wordMatches[i + 1].index : remaining.length;
                const segment = remaining.slice(start, end).trim();
                if (segment.length === 0) continue;
                words.push({ time: wordMatches[i].time, text: segment });
            }
            if (words.length === 0) words = undefined;
        } else {
            plainText = remaining.trim();
        }

        for (const time of stamps) {
            lines.push({ time, text: plainText, words });
        }
    }

    lines.sort((a, b) => a.time - b.time);

    // Apply the optional `[offset:ms]` correction and project end-times
    // from neighbouring start-times. Doing this here means consumers don't
    // need to re-derive the active-line window themselves.
    const offsetSeconds = metadata.offset !== undefined ? metadata.offset / 1000 : 0;
    const withWindow: LyricsLine[] = lines.map((line, index) => {
        const time = line.time - offsetSeconds;
        const next = lines[index + 1];
        const endTime = next ? next.time - offsetSeconds : undefined;
        return { ...line, time, endTime };
    });

    return { lines: withWindow, metadata };
};

/**
 * Index of the active line for a given playback time. Returns `-1` when
 * `time` is before the first timestamp (or the source has no lines).
 *
 * The search is linear because typical LRC files have a few hundred lines
 * at most; the cost is dominated by the React render, not the lookup. If
 * a future use-case ships a five-thousand-line lyric, swap in a binary
 * search — the API is intentionally compatible.
 */
export const findActiveLineIndex = (
    lines: ReadonlyArray<LyricsLine>,
    time: number
): number => {
    if (lines.length === 0 || !Number.isFinite(time)) return -1;
    let active = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].time <= time) active = i;
        else break;
    }
    return active;
};

/**
 * Index of the active word inside a karaoke-enabled line. Returns `-1`
 * when the line has no word-level timings or the time hasn't reached the
 * first word yet.
 */
export const findActiveWordIndex = (
    line: LyricsLine,
    time: number
): number => {
    if (!line.words || line.words.length === 0) return -1;
    let active = -1;
    for (let i = 0; i < line.words.length; i++) {
        if (line.words[i].time <= time) active = i;
        else break;
    }
    return active;
};
