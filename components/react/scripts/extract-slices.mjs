#!/usr/bin/env node
/**
 * Mechanical slice extractor for the per-component translation
 * pattern documented in src/guides/TranslationsGuide.tsx.
 *
 * For every component listed under
 *   Translation.example.examples.<name>
 * the script:
 *   1. extracts the inline type literal from src/languages.ts
 *   2. extracts the matching value literal from src/languages/en-US.ts
 *      and src/languages/de.ts
 *   3. writes src/examples/<name>/translations.ts exposing
 *        export interface <Name>Translation { … }
 *        export const <name>En: <Name>Translation = { … };
 *        export const <name>De: <Name>Translation = { … };
 *   4. replaces the inline blocks in the three originals with
 *        <name>: <Name>Translation;    // type file
 *        <name>: <name>En,              // en-US file
 *        <name>: <name>De,              // de file
 *   5. adds the needed imports to the originals.
 *
 * Skips:
 *   • the `_harness` entry (shared helper, never a component)
 *   • components whose <name> is already a single-line reference
 *     (e.g. Steps, which is already sliced)
 *
 * The script is idempotent — running it twice has no effect after the
 * first run because every block becomes a single-line reference that
 * doesn't match the "inline literal" pattern any more.
 *
 * Run from components/react/:
 *   node scripts/extract-slices.mjs
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const LANG_TS = path.join(ROOT, "src/languages.ts");
const EN_TS = path.join(ROOT, "src/languages/en-US.ts");
const DE_TS = path.join(ROOT, "src/languages/de.ts");
const EXAMPLES_DIR = path.join(ROOT, "src/examples");

const TYPE_INDENT = "                "; // 16 spaces (inside Translation.example.examples)
const VAL_INDENT = "            ";       // 12 spaces (inside the value tree)

function readLines(file) {
    return fs.readFileSync(file, "utf8").split("\n");
}

function writeLines(file, lines) {
    fs.writeFileSync(file, lines.join("\n"));
}

function pascalCase(name) {
    return name.charAt(0).toUpperCase() + name.slice(1);
}

// Strip backtick-quoted strings from a line so we don't miscount braces
// that appear inside translated copy. Locale strings never span multiple
// lines, so per-line stripping is sufficient.
function strip(line) {
    return line.replace(/`(?:[^`\\]|\\.)*`/g, "''");
}

// Given lines and a start index whose line ends with `{`, return the
// 0-based index of the matching close-brace line.
function findBlockEnd(lines, startIdx) {
    let depth = 0;
    let started = false;
    for (let i = startIdx; i < lines.length; i++) {
        const text = strip(lines[i]);
        for (const ch of text) {
            if (ch === "{") {
                depth++;
                started = true;
            } else if (ch === "}") {
                depth--;
                if (started && depth === 0) return i;
            }
        }
    }
    throw new Error(`unbalanced block starting at line ${startIdx + 1}`);
}

// Locate the `examples: {` block inside a file at the given indent level.
// Returns { startBraceLine, endBraceLine }.
function findExamplesBlock(lines, indent) {
    const open = `${indent}examples: {`;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i] === open) {
            const end = findBlockEnd(lines, i);
            return { open: i, close: end };
        }
    }
    throw new Error(`could not locate "${indent}examples: {" in source`);
}

// Walk the children of an examples block, returning a list of
// { name, start, end } where start..end is the line range of the
// child's block (inclusive). Children with the `_harness` name are
// returned too — callers decide what to skip.
function listChildren(lines, examplesStart, examplesEnd, childIndent) {
    // First-child lines look like: `<childIndent><name>: {` (block) OR
    //                              `<childIndent><name>: <ref>;` (already sliced, type file)
    //                              `<childIndent><name>: <ref>,` (already sliced, value file)
    const blockRe = new RegExp(`^${childIndent}([A-Za-z_][A-Za-z0-9_]*): \\{$`);
    const refRe = new RegExp(`^${childIndent}([A-Za-z_][A-Za-z0-9_]*): [^{].*[;,]$`);
    const out = [];
    for (let i = examplesStart + 1; i < examplesEnd; i++) {
        const line = lines[i];
        const m = blockRe.exec(line);
        if (m) {
            const end = findBlockEnd(lines, i);
            out.push({ name: m[1], start: i, end, kind: "block" });
            i = end;
            continue;
        }
        const r = refRe.exec(line);
        if (r) {
            out.push({ name: r[1], start: i, end: i, kind: "ref" });
        }
    }
    return out;
}

function indentBy(text, prefix) {
    return text
        .split("\n")
        .map((line) => (line.length === 0 ? line : prefix + line))
        .join("\n");
}

// Convert a block's raw lines to the slice file's interface / const
// content. The original indent in the source file is stripped so the
// emitted slice file reads top-level. `blockLines` includes the opening
// `<name>: {` line and the closing `}` (or `};` / `},`) line.
function reindent(lines, origIndent) {
    // Strip exactly origIndent from each line that starts with it.
    return lines.map((line) => {
        if (line.startsWith(origIndent)) return line.slice(origIndent.length);
        return line;
    });
}

function renderSliceFile(name, typeBody, enBody, deBody) {
    const TypeName = `${pascalCase(name)}Translation`;
    return `/**
 * Translation slice for ${name}.
 *
 * Owns the type and both locale literals for this feature in one
 * place. Edits to ${name}'s strings happen here; the top-level
 * Translation interface and locale files just reference these exports.
 *
 * Generated by scripts/extract-slices.mjs and intentionally kept
 * verbatim of the original inline literal so a reviewer can compare
 * against git history. Future cleanups (sharing repeated doc helper
 * types, dropping fields, etc.) are welcome but separate.
 */

export interface ${TypeName} ${typeBody}

export const ${name}En: ${TypeName} = ${enBody};

export const ${name}De: ${TypeName} = ${deBody};
`;
}

// Block lines look like:
//   <indent><name>: {
//       ...
//   <indent>}<trailer>
//
// where <trailer> is `;` for type file, `,` for value files. We want
// to produce the body starting from the line containing `{` and ending
// with the matching `}`. Indent is stripped so the emitted body is
// top-level. The `<name>: ` prefix is removed.
function extractBody(lines, start, end, indent) {
    const slice = lines.slice(start, end + 1);
    // First line: `<indent><name>: {`  →  `{`
    slice[0] = "{";
    // Last line: `<indent>}<trailer>`  →  `}`
    slice[slice.length - 1] = "}";
    // Reindent intermediate lines: strip one level of indent (4 spaces)
    // so the body is closer to the file root.
    const stripped = slice.map((line, idx) => {
        if (idx === 0 || idx === slice.length - 1) return line;
        // Original child content was at indent + "    " (one level deeper).
        // After moving to top level, drop indent.length spaces.
        if (line.startsWith(indent)) return line.slice(indent.length);
        return line;
    });
    return stripped.join("\n");
}

function processFile(file, indent, mode) {
    const lines = readLines(file);
    const { open: examplesOpen, close: examplesClose } = findExamplesBlock(lines, indent);
    const childIndent = indent + "    ";
    const children = listChildren(lines, examplesOpen, examplesClose, childIndent);
    return { lines, examplesOpen, examplesClose, childIndent, children, file, mode };
}

function main() {
    const langInfo = processFile(LANG_TS, "            ", "type"); // 12 spaces
    const enInfo = processFile(EN_TS, "        ", "en");           // 8 spaces (one level shallower in values)
    const deInfo = processFile(DE_TS, "        ", "de");

    // Sanity: child indents should match what we expect.
    // languages.ts: declare module → interface → example → examples
    //   so examples sits at column 12, its children at column 16
    // languages/<l>.ts: const translation: Translation = { example: { examples: { … } } }
    //   so examples sits at column 8, its children at column 12
    //
    // Confirm by sampling the first child line.

    const typeChildren = new Map();
    for (const c of langInfo.children) typeChildren.set(c.name, c);
    const enChildren = new Map();
    for (const c of enInfo.children) enChildren.set(c.name, c);
    const deChildren = new Map();
    for (const c of deInfo.children) deChildren.set(c.name, c);

    const components = [...typeChildren.keys()].filter((n) => n !== "_harness");

    const processed = [];
    const skipped = [];

    for (const name of components) {
        const typeC = typeChildren.get(name);
        const enC = enChildren.get(name);
        const deC = deChildren.get(name);

        if (!enC || !deC) {
            skipped.push({ name, reason: "missing in locale file" });
            continue;
        }
        // Skip already-sliced (single-line reference in all three files).
        if (typeC.kind === "ref" || enC.kind === "ref" || deC.kind === "ref") {
            if (typeC.kind === "ref" && enC.kind === "ref" && deC.kind === "ref") {
                skipped.push({ name, reason: "already sliced" });
            } else {
                skipped.push({ name, reason: "mixed kinds (manual review)" });
            }
            continue;
        }

        // Extract bodies.
        const typeBody = extractBody(
            langInfo.lines,
            typeC.start,
            typeC.end,
            langInfo.childIndent
        );
        const enBody = extractBody(enInfo.lines, enC.start, enC.end, enInfo.childIndent);
        const deBody = extractBody(deInfo.lines, deC.start, deC.end, deInfo.childIndent);

        // Generate slice file.
        const sliceDir = path.join(EXAMPLES_DIR, name);
        const slicePath = path.join(sliceDir, "translations.ts");
        if (fs.existsSync(slicePath)) {
            skipped.push({ name, reason: "slice file already exists" });
            continue;
        }
        if (!fs.existsSync(sliceDir)) {
            fs.mkdirSync(sliceDir, { recursive: true });
        }
        fs.writeFileSync(slicePath, renderSliceFile(name, typeBody, enBody, deBody));

        processed.push({ name });
    }

    if (processed.length === 0) {
        console.log("nothing to do — all components already sliced or skipped.");
        return;
    }

    // Now rewrite the three source files. Strategy: walk children list
    // in REVERSE so earlier line indexes stay valid.
    function rewrite(info, formatRef) {
        const lines = info.lines.slice();
        const sortedChildren = [...info.children].sort((a, b) => b.start - a.start);
        for (const c of sortedChildren) {
            if (c.kind !== "block") continue;
            const name = c.name;
            if (!processed.some((p) => p.name === name)) continue;
            const newLine = info.childIndent + formatRef(name);
            lines.splice(c.start, c.end - c.start + 1, newLine);
        }
        return lines;
    }

    const langOut = rewrite(langInfo, (n) => `${n}: ${pascalCase(n)}Translation;`);
    const enOut = rewrite(enInfo, (n) => `${n}: ${n}En,`);
    const deOut = rewrite(deInfo, (n) => `${n}: ${n}De,`);

    // Add imports. For src/languages.ts: type imports. For locale files: value imports.
    // Insert each block right above the existing `import type { StepsTranslation }` /
    // `import { stepsEn }` line if present; otherwise append to the top import block.

    function injectImports(lines, kind) {
        // Find the last existing top-of-file import line so we can append after it.
        let lastImport = -1;
        for (let i = 0; i < lines.length; i++) {
            if (/^import .+ from /.test(lines[i])) lastImport = i;
            else if (lastImport >= 0 && lines[i].trim() === "") break;
        }
        if (lastImport < 0) {
            throw new Error("no import line found in target file");
        }
        const lines2 = lines.slice();
        const newImports = processed
            .map(({ name }) => {
                if (kind === "type")
                    return `import type { ${pascalCase(name)}Translation } from "./examples/${name}/translations";`;
                if (kind === "en")
                    return `import { ${name}En } from "../examples/${name}/translations";`;
                if (kind === "de")
                    return `import { ${name}De } from "../examples/${name}/translations";`;
                throw new Error("kind?");
            })
            .sort();
        lines2.splice(lastImport + 1, 0, ...newImports);
        return lines2;
    }

    writeLines(LANG_TS, injectImports(langOut, "type"));
    writeLines(EN_TS, injectImports(enOut, "en"));
    writeLines(DE_TS, injectImports(deOut, "de"));

    console.log(`processed ${processed.length} components:`);
    for (const p of processed) console.log(`  ✓ ${p.name}`);
    if (skipped.length > 0) {
        console.log(`\nskipped ${skipped.length}:`);
        for (const s of skipped) console.log(`  - ${s.name}: ${s.reason}`);
    }
}

main();
