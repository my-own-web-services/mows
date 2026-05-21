#!/usr/bin/env node
// One-shot fixer for stale `testLine:` values in *DocPage.tsx files.
//
// For each `BehaviourEntry { testFile, testLine, testName }` literal, locates
// the corresponding `it("<testName>", …)` line in the referenced test file
// and rewrites `testLine: N` to the actual line number. A no-op when the
// numbers already match.
//
// Run with: `node scripts/fix-behaviour-line-numbers.mjs`
// (from `components/react/`). The companion test
// `src/examples/harness/docPage/behaviourEntryIntegrity.test.ts` becomes the
// permanent regression guard.

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const EXAMPLES_DIR = join(REPO_ROOT, "src", "examples");

const walk = (root, suffix) => {
    const out = [];
    const stack = [root];
    while (stack.length > 0) {
        const dir = stack.pop();
        for (const name of readdirSync(dir)) {
            const full = join(dir, name);
            const stats = statSync(full);
            if (stats.isDirectory()) stack.push(full);
            else if (name.endsWith(suffix)) out.push(full);
        }
    }
    return out;
};

const ENTRY_RE = /\{\s*statement:[\s\S]*?\}(?=,|\s*\])/g;
const TEST_FILE_STRING_RE = /testFile:\s*[`"]([^`"]+)[`"]/;
const TEST_FILE_IDENT_RE = /testFile:\s*([A-Za-z_][A-Za-z0-9_]*)/;
const TEST_LINE_RE = /testLine:\s*(\d+)/;
const TEST_NAME_RES = [
    /testName:\s*`([^`]+)`/,
    /testName:\s*"([^"]+)"/,
    /testName:\s*'([^']+)'/
];
const matchTestName = (block) => {
    for (const re of TEST_NAME_RES) {
        const m = block.match(re);
        if (m) return m[1];
    }
    return undefined;
};
const CONST_DEF_RE = /^\s*const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*[`"]([^`"]+)[`"]/gm;

const buildLineIndex = (sourceText) => {
    const lines = sourceText.split("\n");
    const index = new Map();
    const RES = [
        /^\s*it(?:\.each\([\s\S]*?\))?\(\s*`([^`]+)`/,
        /^\s*it(?:\.each\([\s\S]*?\))?\(\s*"([^"]+)"/,
        /^\s*it(?:\.each\([\s\S]*?\))?\(\s*'([^']+)'/
    ];
    lines.forEach((line, idx) => {
        for (const re of RES) {
            const m = line.match(re);
            if (m) {
                const existing = index.get(m[1]) ?? [];
                existing.push(idx + 1);
                index.set(m[1], existing);
                break;
            }
        }
    });
    return index;
};

const testSourceCache = new Map();
const loadTestSource = (relPath) => {
    if (testSourceCache.has(relPath)) return testSourceCache.get(relPath);
    const full = relPath.startsWith("/") ? relPath : join(REPO_ROOT, relPath);
    try {
        const src = readFileSync(full, "utf8");
        testSourceCache.set(relPath, src);
        return src;
    } catch {
        testSourceCache.set(relPath, null);
        return null;
    }
};

let totalFixed = 0;
let totalUnresolvable = 0;
const unresolvable = [];

for (const docPagePath of walk(EXAMPLES_DIR, "DocPage.tsx")) {
    const original = readFileSync(docPagePath, "utf8");
    const consts = new Map();
    for (const m of original.matchAll(CONST_DEF_RE)) consts.set(m[1], m[2]);

    let updated = original;
    let fileFixed = 0;

    updated = updated.replace(ENTRY_RE, (block) => {
        const file =
            block.match(TEST_FILE_STRING_RE)?.[1] ??
            consts.get(block.match(TEST_FILE_IDENT_RE)?.[1] ?? "");
        const name = matchTestName(block);
        const lineRaw = block.match(TEST_LINE_RE)?.[1];
        if (!file || !name || !lineRaw) return block;
        const src = loadTestSource(file);
        if (!src) {
            unresolvable.push(`${docPagePath}: test file missing → ${file}`);
            totalUnresolvable++;
            return block;
        }
        const index = buildLineIndex(src);
        const realLines = index.get(name);
        if (!realLines || realLines.length === 0) {
            unresolvable.push(`${docPagePath}: no test named ${JSON.stringify(name)} in ${file}`);
            totalUnresolvable++;
            return block;
        }
        const currentLine = Number.parseInt(lineRaw, 10);
        if (realLines.includes(currentLine)) return block;
        const targetLine = realLines[0];
        fileFixed++;
        totalFixed++;
        return block.replace(TEST_LINE_RE, `testLine: ${targetLine}`);
    });

    if (fileFixed > 0) {
        writeFileSync(docPagePath, updated, "utf8");
        console.log(`Fixed ${fileFixed} entries in ${docPagePath.replace(REPO_ROOT + "/", "")}`);
    }
}

console.log(`\nTotal entries auto-corrected: ${totalFixed}`);
console.log(`Unresolvable (need manual rewrite): ${totalUnresolvable}`);
for (const line of unresolvable) {
    console.log(`  - ${line}`);
}
