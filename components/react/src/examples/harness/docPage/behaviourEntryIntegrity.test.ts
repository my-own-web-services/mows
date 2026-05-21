// Guard that every `BehaviourEntry { testFile, testLine, testName }` literal
// across all *DocPage.tsx files points at a real test, with a `testLine`
// equal to the line where that test's `it()` block actually starts.
//
// Without this guard the harness silently mis-routes "verified by" chips
// to the wrong line in a test file (or even the wrong test). DOC-3 / DOC-11
// in the 2026-05-20 review flagged 177 stale references across 39 DocPages.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

interface ExtractedEntry {
    docPagePath: string;
    testFile: string;
    testLine: number;
    testName: string;
}

const REPO_ROOT = (() => {
    // Walk up from this file's directory until we find the package root
    // (the directory that contains both `lib/` and `src/`).
    let dir = new URL(".", import.meta.url).pathname;
    while (dir !== "/" && dir.length > 1) {
        if (existsSync(join(dir, "lib")) && existsSync(join(dir, "src"))) return dir;
        const parent = join(dir, "..");
        if (parent === dir) break;
        dir = parent;
    }
    return process.cwd();
})();

const EXAMPLES_DIR = join(REPO_ROOT, "src", "examples");

const walk = (root: string, suffix: string): string[] => {
    const out: string[] = [];
    const stack: string[] = [root];
    while (stack.length > 0) {
        const dir = stack.pop()!;
        for (const name of readdirSync(dir)) {
            const full = join(dir, name);
            const stats = statSync(full);
            if (stats.isDirectory()) {
                stack.push(full);
            } else if (name.endsWith(suffix)) {
                out.push(full);
            }
        }
    }
    return out;
};

const docPageFiles = walk(EXAMPLES_DIR, "DocPage.tsx");

// Match every `{ … testFile: …, testName: \`…\`, testLine: N … }` literal
// (fields may appear in any order). DocPages typically declare a
// `TEST_FILE = \`lib/.../X.test.tsx\`` constant and reference it via a bare
// identifier; we resolve that mapping per-file.
const ENTRY_RE = /\{\s*statement:[\s\S]*?\}(?:,|\s*\])/g;
const TEST_FILE_STRING_RE = /testFile:\s*[`"]([^`"]+)[`"]/;
const TEST_FILE_IDENT_RE = /testFile:\s*([A-Za-z_][A-Za-z0-9_]*)/;
const TEST_LINE_RE = /testLine:\s*(\d+)/;
// Three variants: backtick / double-quote / single-quote. Each only stops
// at its own delimiter so embedded apostrophes / quotes inside the test
// name aren't mistaken for terminators.
const TEST_NAME_RES: ReadonlyArray<RegExp> = [
    /testName:\s*`([^`]+)`/,
    /testName:\s*"([^"]+)"/,
    /testName:\s*'([^']+)'/
];
const matchTestName = (block: string): string | undefined => {
    for (const re of TEST_NAME_RES) {
        const m = block.match(re);
        if (m) return m[1];
    }
    return undefined;
};
const CONST_DEF_RE = /^\s*const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*[`"]([^`"]+)[`"]/gm;

const collectConsts = (source: string): Map<string, string> => {
    const out = new Map<string, string>();
    for (const m of source.matchAll(CONST_DEF_RE)) {
        out.set(m[1], m[2]);
    }
    return out;
};

const extractEntries = (docPagePath: string, source: string): ExtractedEntry[] => {
    const out: ExtractedEntry[] = [];
    const consts = collectConsts(source);
    const matches = source.match(ENTRY_RE) ?? [];
    for (const block of matches) {
        const file =
            block.match(TEST_FILE_STRING_RE)?.[1] ??
            consts.get(block.match(TEST_FILE_IDENT_RE)?.[1] ?? "");
        const lineRaw = block.match(TEST_LINE_RE)?.[1];
        const name = matchTestName(block);
        if (!file || !lineRaw || !name) continue;
        out.push({
            docPagePath,
            testFile: file,
            testLine: Number.parseInt(lineRaw, 10),
            testName: name
        });
    }
    return out;
};

const allEntries: ExtractedEntry[] = docPageFiles.flatMap((path) =>
    extractEntries(path, readFileSync(path, "utf8"))
);

const buildLineIndex = (sourceText: string): Map<string, number[]> => {
    const lines = sourceText.split("\n");
    const index = new Map<string, number[]>();
    // Single-line `it(\`name\`, …)`.
    const singleLineRes: RegExp[] = [
        /^\s*it\(\s*`([^`]+)`/,
        /^\s*it\(\s*"([^"]+)"/,
        /^\s*it\(\s*'([^']+)'/
    ];
    // Open of `it.each([` — we'll scan forward for the matching `])(name`.
    const itEachOpenRe = /^\s*(it\.each\(\[)/;
    // Closing-and-name patterns for the multi-line `]) (name)` form.
    const closeRes: RegExp[] = [
        /\]\s*(?:as\s+const\s*)?\)\(\s*`([^`]+)`/,
        /\]\s*(?:as\s+const\s*)?\)\(\s*"([^"]+)"/,
        /\]\s*(?:as\s+const\s*)?\)\(\s*'([^']+)'/
    ];
    lines.forEach((line, idx) => {
        for (const re of singleLineRes) {
            const m = line.match(re);
            if (m) {
                const existing = index.get(m[1]) ?? [];
                existing.push(idx + 1);
                index.set(m[1], existing);
                return;
            }
        }
        // Multi-line it.each: the doc page records the line where the
        // `it.each([` opens; bind that line number to the closing `])(name`
        // we find downstream.
        if (itEachOpenRe.test(line)) {
            for (let scan = idx + 1; scan < Math.min(lines.length, idx + 40); scan++) {
                for (const re of closeRes) {
                    const m = lines[scan].match(re);
                    if (m) {
                        const existing = index.get(m[1]) ?? [];
                        existing.push(idx + 1);
                        index.set(m[1], existing);
                        return;
                    }
                }
            }
        }
    });
    return index;
};

describe("BehaviourEntry integrity across all DocPages", () => {
    it("finds at least one entry to verify (sanity check)", () => {
        expect(allEntries.length).toBeGreaterThan(0);
    });

    for (const entry of allEntries) {
        const absoluteTestPath = entry.testFile.startsWith("/")
            ? entry.testFile
            : join(REPO_ROOT, entry.testFile);
        const label =
            `${entry.docPagePath.replace(/.*\/examples\//, "examples/")} → ` +
            `${entry.testFile}:${entry.testLine} (${entry.testName.slice(0, 60)})`;

        it(label, () => {
            expect(
                existsSync(absoluteTestPath),
                `test file not found: ${entry.testFile}`
            ).toBe(true);
            const lineIndex = buildLineIndex(readFileSync(absoluteTestPath, "utf8"));
            const realLines = lineIndex.get(entry.testName);
            expect(
                realLines,
                `no test named ${JSON.stringify(entry.testName)} in ${entry.testFile}`
            ).toBeTruthy();
            // If the same name appears multiple times (uncommon), accept any of them.
            expect(
                realLines!.includes(entry.testLine),
                `testLine ${entry.testLine} does not match actual line(s) ${realLines!.join(", ")}`
            ).toBe(true);
        });
    }
});
