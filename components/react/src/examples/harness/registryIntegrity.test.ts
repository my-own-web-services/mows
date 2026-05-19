import { describe, expect, it } from "vitest";
import { cleanExampleSource } from "./cleanExampleSource";
import { codeSnippetExamples } from "../codeSnippet";
import { fileIconExamples } from "../fileIcon";
import { pageIndexExamples } from "../pageIndex";
import { stepsExamples } from "../steps";
import type { RegisteredExample } from "./types";

// Cross-registry guarantee: the source shown in the "Code" tab is the
// exact source that runs to produce the preview. Both come from the same
// `.tsx` file — the executable export is imported normally and the raw
// text via Vite's `?raw` suffix — but `cleanExampleSource` strips harness-
// only lines before display. This suite walks every registered example
// and pins the structural invariants of that cleaned output, so it can't
// silently drift away from the runtime component.

const ALL_REGISTRIES: ReadonlyArray<{
    name: string;
    examples: ReadonlyArray<RegisteredExample>;
}> = [
    { name: `steps`, examples: stepsExamples },
    { name: `pageIndex`, examples: pageIndexExamples },
    { name: `codeSnippet`, examples: codeSnippetExamples },
    { name: `fileIcon`, examples: fileIconExamples }
];

describe(`registry integrity — code shown == code that runs`, () => {
    for (const { name, examples } of ALL_REGISTRIES) {
        describe(name, () => {
            for (const example of examples) {
                describe(`${name}/${example.id}`, () => {
                    const cleaned = cleanExampleSource(example.source);

                    it(`raw source is non-empty (Vite ?raw import resolved)`, () => {
                        expect(example.source.length).toBeGreaterThan(0);
                    });

                    it(`cleaned source contains the Example declaration that renders the preview`, () => {
                        expect(cleaned).toMatch(/(?:const|function)\s+Example\b/);
                    });

                    it(`cleaned source strips harness scaffolding`, () => {
                        // Harness imports must not appear in what the reader copies.
                        expect(cleaned).not.toMatch(/from\s+["']\.\.\/harness\//);
                        // The ExampleModule trailer must be gone.
                        expect(cleaned).not.toMatch(/const\s+module\s*:\s*ExampleModule\b/);
                        // Standalone useExampleState() calls must be gone.
                        expect(cleaned).not.toMatch(/^\s*useExampleState\s*\(/m);
                    });

                    it(`cleaned source is non-empty after stripping`, () => {
                        expect(cleaned.trim().length).toBeGreaterThan(0);
                    });
                });
            }
        });
    }
});
