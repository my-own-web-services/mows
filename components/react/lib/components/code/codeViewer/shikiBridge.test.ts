import { afterEach, describe, expect, it, vi } from "vitest";

// Stub the heavy shiki highlighter — we don't need real tokenization
// in this test, only that `ensureShikiMonacoReady` registers brackets
// for every language it claims to support.
vi.mock(`./shikiHighlighter`, () => ({
    getShikiHighlighter: vi.fn(async () => ({})),
    isSupportedThemeId: vi.fn(() => true),
    SHIKI_LANG_IDS: [`tsx`, `jsx`, `typescript`, `javascript`, `json`, `yaml`],
    SHIKI_THEME_IDS: [],
    SHIKI_THEME_NAME: `default`
}));

// shikiToMonaco would try to walk a real highlighter — silence it.
vi.mock(`@shikijs/monaco`, () => ({ shikiToMonaco: vi.fn() }));

// monaco-editor is heavy and irrelevant here; the bridge accepts a
// `m: typeof monaco` parameter so callers can pass a stub.
vi.mock(`monaco-editor`, () => ({}));

const buildMonacoStub = () => {
    const register = vi.fn();
    const setLanguageConfiguration = vi.fn();
    const getLanguages = vi.fn(() => []);
    return {
        m: { languages: { register, setLanguageConfiguration, getLanguages } },
        register,
        setLanguageConfiguration,
        getLanguages
    };
};

describe(`ensureShikiMonacoReady`, () => {
    afterEach(() => {
        // The bridge memoises its setup promise at module scope, so each
        // test needs a fresh module to exercise the registration path.
        vi.resetModules();
    });

    it(`registers Monaco bracket configuration for every supported language`, async () => {
        const { ensureShikiMonacoReady, LANGUAGE_BRACKETS } = await import(`./shikiBridge`);
        const { m, setLanguageConfiguration } = buildMonacoStub();

        await ensureShikiMonacoReady(m as never);

        const configuredIds = setLanguageConfiguration.mock.calls.map(
            (args) => args[0] as string
        );
        for (const id of Object.keys(LANGUAGE_BRACKETS)) {
            expect(configuredIds).toContain(id);
            const call = setLanguageConfiguration.mock.calls.find(
                (args) => args[0] === id
            );
            expect(call?.[1]?.brackets).toBeDefined();
            expect((call?.[1]?.brackets as unknown[]).length).toBeGreaterThan(0);
        }
    });

    it(`configures only structural brackets for JSON and YAML (no parens)`, async () => {
        const { LANGUAGE_BRACKETS } = await import(`./shikiBridge`);
        // JSON / YAML must not list `()` as a bracket pair — incidental
        // parens inside string values would otherwise be colorized as if
        // they were syntax. Locking this in protects the original
        // "no surprise coloring" guarantee.
        for (const id of [`json`, `yaml`] as const) {
            const pairs = LANGUAGE_BRACKETS[id] as readonly (readonly [string, string])[];
            const opens = pairs.map((p) => p[0]);
            expect(opens).not.toContain(`(`);
            expect(opens).toContain(`{`);
            expect(opens).toContain(`[`);
        }
    });

    it(`is idempotent — repeated calls do not re-register configuration`, async () => {
        const { ensureShikiMonacoReady } = await import(`./shikiBridge`);
        const { m, setLanguageConfiguration } = buildMonacoStub();

        await ensureShikiMonacoReady(m as never);
        const firstCallCount = setLanguageConfiguration.mock.calls.length;
        await ensureShikiMonacoReady(m as never);
        expect(setLanguageConfiguration.mock.calls.length).toBe(firstCallCount);
    });
});
