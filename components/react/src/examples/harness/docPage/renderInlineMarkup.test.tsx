import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { defaultCodeThemes } from "../../../../lib/lib/codeThemes";
import enTranslation from "../../../../lib/lib/languages/en-US/default";
import { ActionManager } from "../../../../lib/lib/mowsContext/ActionManager";
import { HotkeyManager } from "../../../../lib/lib/mowsContext/HotkeyManager";
import {
    defaultCodeEditorSettings,
    defaultToastSettings,
    MowsContext,
    type MowsContextType
} from "../../../../lib/lib/mowsContext/MowsContext";
import { renderInlineMarkup, renderDescription } from "./renderInlineMarkup";
import {
    __resetComponentLinkRegistryForTests,
    registerDemoLinks,
    registerGuideLinks
} from "../../../componentLinkRegistry";

// Minimal MowsContext value — `<InlineCodeChip>` now routes through
// `<CodeSnippet>` which calls `useMows()`. The hook throws without a
// provider, so every test renders inside one.
const buildContext = (): MowsContextType => {
    const am = new ActionManager({
        recentActionsStorageKey: `test_recent_${Math.random()}`,
        maxRecentActions: 5
    });
    const hk = new HotkeyManager(am, {
        configStorageKey: `test_hk_${Math.random()}`,
        defaultHotkeys: {}
    });
    return {
        auth: {} as never,
        authConfigured: false,
        mowsUser: null,
        storagePrefix: `test`,
        setTheme: async () => undefined,
        currentTheme: { id: `light`, name: `Light` },
        setLanguage: () => undefined,
        codeEditorSettings: defaultCodeEditorSettings,
        setCodeEditorSettings: () => undefined,
        toastSettings: defaultToastSettings,
        setToastSettings: () => undefined,
        t: enTranslation,
        currentLanguage: undefined,
        themes: [],
        languages: [],
        actionManager: am,
        hotkeyManager: hk,
        currentlyOpenModal: undefined,
        changeActiveModal: () => undefined,
        codeThemes: defaultCodeThemes,
        currentCodeTheme: defaultCodeThemes[0],
        setCodeTheme: () => undefined
    };
};

const renderWithCtx = (nodes: React.ReactNode[]) =>
    render(<MowsContext.Provider value={buildContext()}>{nodes}</MowsContext.Provider>);

describe(`renderInlineMarkup`, () => {
    it(`promotes <TagName> patterns to inline code chips`, () => {
        const { container } = renderWithCtx(renderInlineMarkup(`Use <Steps> with <Step />.`));
        const chips = container.querySelectorAll(`code`);
        expect(chips).toHaveLength(2);
        expect(chips[0]).toHaveTextContent(`<Steps>`);
        expect(chips[1]).toHaveTextContent(`<Step />`);
    });

    it(`promotes backticked spans, stripping the backticks`, () => {
        const { container } = renderWithCtx(
            renderInlineMarkup(`Pass \`mode="selection"\` to switch modes.`)
        );
        const chip = container.querySelector(`code`);
        expect(chip).toHaveTextContent(`mode="selection"`);
        // Ensure backticks aren't in the rendered text.
        expect(container.textContent).not.toMatch(/`/);
    });

    it(`leaves plain text between matches verbatim`, () => {
        const { container } = renderWithCtx(renderInlineMarkup(`Wrap <Steps> in dir="rtl".`));
        expect(container.textContent).toBe(`Wrap <Steps> in dir="rtl".`);
    });

    it(`renders chips as monospace code elements`, () => {
        const { container } = renderWithCtx(renderInlineMarkup(`<Steps>`));
        const chip = container.querySelector(`code`);
        expect(chip).toBeTruthy();
        // CodeSnippet's inline form adds the .CodeSnippet marker class so
        // styling can be targeted from the rest of the harness.
        expect(chip?.className).toMatch(/CodeSnippet/);
        expect(chip?.className).toMatch(/font-mono/);
    });

    it(`renderDescription passes ReactNode through unchanged`, () => {
        const node = <span data-testid={`x`}>Hi</span>;
        expect(renderDescription(node)).toBe(node);
    });

    it(`renderDescription promotes string input`, () => {
        const out = renderDescription(`<Steps>`);
        expect(Array.isArray(out)).toBe(true);
    });

    describe(`cross-doc linking`, () => {
        beforeEach(() => {
            __resetComponentLinkRegistryForTests();
            registerDemoLinks([{ name: `PrimaryMenu` }, { name: `Compass` }]);
            registerGuideLinks([{ name: `CreatingApps` }]);
            window.history.replaceState({}, ``, `/Compass`);
        });

        it(`wraps registered <Tag> mentions in a doc-page anchor`, () => {
            const { container } = renderWithCtx(
                renderInlineMarkup(`Mount under <PrimaryMenu>.`)
            );
            const link = container.querySelector(
                `a[data-component-doc-link="PrimaryMenu"]`
            );
            expect(link).toBeTruthy();
            expect(link?.getAttribute(`href`)).toBe(`/PrimaryMenu`);
            expect(link?.querySelector(`code`)).toHaveTextContent(`<PrimaryMenu>`);
        });

        it(`also links JSX tags wrapped in backticks`, () => {
            const { container } = renderWithCtx(
                renderInlineMarkup(`See \`<PrimaryMenu>\` for details.`)
            );
            const link = container.querySelector(
                `a[data-component-doc-link="PrimaryMenu"]`
            );
            expect(link).toBeTruthy();
        });

        it(`links guide names too`, () => {
            const { container } = renderWithCtx(
                renderInlineMarkup(`Read <CreatingApps> first.`)
            );
            const link = container.querySelector(
                `a[data-component-doc-link="CreatingApps"]`
            );
            expect(link?.getAttribute(`href`)).toBe(`/guide/CreatingApps`);
        });

        it(`does not link unregistered names`, () => {
            const { container } = renderWithCtx(
                renderInlineMarkup(`Use <SomethingNew> for that.`)
            );
            expect(container.querySelectorAll(`a[data-component-doc-link]`)).toHaveLength(
                0
            );
            expect(container.querySelector(`code`)).toHaveTextContent(
                `<SomethingNew>`
            );
        });

        it(`suppresses the anchor when the path matches the current page`, () => {
            window.history.replaceState({}, ``, `/PrimaryMenu`);
            const { container } = renderWithCtx(
                renderInlineMarkup(`Compose with <PrimaryMenu>.`)
            );
            expect(container.querySelectorAll(`a[data-component-doc-link]`)).toHaveLength(
                0
            );
            expect(container.querySelector(`code`)).toHaveTextContent(`<PrimaryMenu>`);
        });

        it(`routes clicks via pushState + popstate instead of hard navigation`, () => {
            const { container } = renderWithCtx(
                renderInlineMarkup(`Mount under <PrimaryMenu>.`)
            );
            const link = container.querySelector<HTMLAnchorElement>(
                `a[data-component-doc-link="PrimaryMenu"]`
            );
            expect(link).toBeTruthy();
            let popped = false;
            const onPop = () => {
                popped = true;
            };
            window.addEventListener(`popstate`, onPop);
            link!.click();
            window.removeEventListener(`popstate`, onPop);
            expect(window.location.pathname).toBe(`/PrimaryMenu`);
            expect(popped).toBe(true);
        });
    });
});
