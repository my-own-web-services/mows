// FUTURE-7: structural-compliance check across every shipped locale.
//
// `BaseTranslation` is the contract every locale file must satisfy. The
// import statements below force TypeScript to type-check each locale's
// default export against `BaseTranslation` at test-compile time — if a
// new key is added to `BaseTranslation` and forgotten in either locale,
// this file fails to compile and `pnpm test` surfaces the regression
// before runtime fallback gaps appear in the UI.
//
// No runtime assertions are needed for the structural check itself, but
// we include one trivial assertion per locale so the test framework
// counts a passing test (and so an accidental empty export still
// triggers a clear failure).

import { describe, expect, it } from "vitest";
import type { BaseTranslation } from "../languages";
import enUsDefault from "./en-US/default";
import deDefault from "./de/default";

// Compile-time type assertions: each import is widened to `BaseTranslation`
// to force structural compatibility.
const enUs: BaseTranslation = enUsDefault;
const de: BaseTranslation = deDefault;

describe("locale files satisfy BaseTranslation", () => {
    it("en-US/default exports a non-empty translation tree", () => {
        expect(Object.keys(enUs).length).toBeGreaterThan(0);
    });

    it("de/default exports a non-empty translation tree", () => {
        expect(Object.keys(de).length).toBeGreaterThan(0);
    });
});
