import { describe, expect, it } from "vitest";
import { stepsDe, stepsEn } from "./examples/steps/translations";
import { languages, type Translation } from "./languages";

describe(`languages registry`, () => {
    it(`exposes both supported locales with stable codes`, () => {
        const codes = languages.map((l) => l.code).sort();
        expect(codes).toEqual([`de`, `en-US`]);
    });

    it(`every Language entry exposes an import thunk that returns a Translation`, async () => {
        for (const lang of languages) {
            expect(typeof lang.import).toBe(`function`);
            const mod = await lang.import();
            expect(mod).toHaveProperty(`default`);
            const t = mod.default;
            expect(typeof t.primaryMenu.login).toBe(`string`);
            expect(typeof t.example.pageTitle).toBe(`string`);
        }
    });

    it(`the de and en-US thunks resolve to different translation trees`, async () => {
        const en = await languages.find((l) => l.code === `en-US`)!.import();
        const de = await languages.find((l) => l.code === `de`)!.import();
        expect(en.default).not.toBe(de.default);
        expect(en.default.example.pageTitle).not.toEqual(de.default.example.pageTitle);
    });

    it(`the same import thunk returns a stable reference across calls (module cache)`, async () => {
        const lang = languages.find((l) => l.code === `en-US`)!;
        const first = await lang.import();
        const second = await lang.import();
        expect(first.default).toBe(second.default);
    });

    it(`the Steps slice constants are the same identity that flows into the locale tree`, async () => {
        const en = (await languages.find((l) => l.code === `en-US`)!.import()).default;
        const de = (await languages.find((l) => l.code === `de`)!.import()).default;
        expect(en.example.examples.steps).toBe(stepsEn);
        expect(de.example.examples.steps).toBe(stepsDe);
    });

    it(`every key required by the Translation interface is present after a dynamic load (compile + runtime)`, async () => {
        const en = (await languages.find((l) => l.code === `en-US`)!.import()).default;
        // Sample a key from each top-level group the app declares — if any
        // slice ever drifts the typed access on the next line fails the
        // compile and this whole file refuses to type-check.
        const samples: string[] = [
            en.primaryMenu.login,
            en.example.examples.steps.horizontal.title,
            en.example.examples.steps.doc.installation.title,
            en.example.examples.steps.doc.definedBehaviour.statements.derivesStatuses,
            en.example.guides.translations.title
        ];
        for (const value of samples) {
            expect(typeof value).toBe(`string`);
            expect(value.length).toBeGreaterThan(0);
        }
    });

    it(`a freshly-loaded German translation differs from the English Steps slice`, async () => {
        const de = (await languages.find((l) => l.code === `de`)!.import()).default;
        expect(de.example.examples.steps.horizontal.title).not.toEqual(
            stepsEn.horizontal.title
        );
        // Sanity: it equals the de slice value.
        expect(de.example.examples.steps.horizontal.title).toEqual(stepsDe.horizontal.title);
    });

    it(`Translation type satisfies basic shape checks for both locales`, async () => {
        const both: Translation[] = [];
        for (const lang of languages) {
            both.push((await lang.import()).default);
        }
        for (const t of both) {
            expect(t.example.examples.steps.doc.examples.line.title.length).toBeGreaterThan(0);
        }
    });
});
